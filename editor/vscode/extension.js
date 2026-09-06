// Docent: plays a code tour. The editor scrolls itself, spotlights the lines
// being discussed, and narrates beside them. The author watches unless they
// pause.
//
// Reads .docent/tour.json from the workspace root and reloads on change, so
// the walk can extend the tour while it plays.

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

let tour = { steps: [] };
let index = 0;
let playing = false;
let speed = 1;
let timer = null;
let panel = null;
let status = null;

let dim;        // everything outside the focus
let spot;       // the focused lines
let cursorLine; // the single line currently being pointed at

function root() {
  const f = vscode.workspace.workspaceFolders;
  return f && f.length ? f[0].uri.fsPath : null;
}

function loadTour() {
  const r = root();
  if (!r) return false;
  const p = path.join(r, '.docent', 'tour.json');
  if (!fs.existsSync(p)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    tour = { steps: raw.steps || [], title: raw.title || 'walkthrough' };
    if (index >= tour.steps.length) index = Math.max(0, tour.steps.length - 1);
    return true;
  } catch (e) {
    // A tour half written by the walk is expected; keep what we have.
    return tour.steps.length > 0;
  }
}

// Seconds a step is held. Reading speed is the constraint, so it scales with
// how much there is to read, and speed divides it.
function holdFor(step) {
  const words = (step.narration || '').split(/\s+/).length;
  const lines = step.focus ? step.focus[1] - step.focus[0] + 1 : 1;
  const secs = Math.max(4, words / 3.0 + lines * 0.4);
  return (secs / speed) * 1000;
}

function remainingMinutes() {
  let ms = 0;
  for (let i = index; i < tour.steps.length; i++) ms += holdFor(tour.steps[i]);
  return Math.max(1, Math.round(ms / 60000));
}

async function render() {
  const step = tour.steps[index];
  if (!step) return;
  const r = root();
  const uri = vscode.Uri.file(path.isAbsolute(step.file) ? step.file : path.join(r, step.file));

  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc, {
    viewColumn: vscode.ViewColumn.One,
    preserveFocus: true,
    preview: true,
  });

  const last = doc.lineCount - 1;
  const from = Math.max(0, (step.focus ? step.focus[0] : 1) - 1);
  const to = Math.min(last, (step.focus ? step.focus[1] : from + 1) - 1);
  const focusRange = new vscode.Range(from, 0, to, doc.lineAt(to).text.length);

  // Spotlight: dim what is not being discussed, so the eye has one place to go.
  const before = new vscode.Range(0, 0, Math.max(0, from - 1), 0);
  const after = new vscode.Range(Math.min(last, to + 1), 0, last, 0);
  editor.setDecorations(dim, from > 0 || to < last ? [before, after] : []);
  editor.setDecorations(spot, [focusRange]);

  // The pointer line carries the one-line label, if the step has one.
  const pointer = step.point ? Math.min(last, step.point - 1) : from;
  editor.setDecorations(cursorLine, step.label ? [{
    range: new vscode.Range(pointer, 0, pointer, doc.lineAt(pointer).text.length),
    renderOptions: { after: { contentText: `   ${step.label}` } },
  }] : []);

  editor.revealRange(focusRange, vscode.TextEditorRevealType.InCenter);
  showNarration(step);
  updateStatus();
}

function showNarration(step) {
  if (!panel) return;
  const n = tour.steps.length;
  const claims = (step.claims || []).map((c) => {
    const cls = String(c.class || 'inferred');
    return `<div class="claim ${cls}"><span class="k">${cls}</span>${escapeHtml(c.text)}` +
      (c.evidence ? `<div class="ev">${escapeHtml(c.evidence)}</div>` : '') + `</div>`;
  }).join('');

  panel.webview.html = `<!doctype html><meta charset="utf-8">
<style>
 body{font:14px/1.65 var(--vscode-font-family);color:var(--vscode-foreground);
      padding:18px 20px;margin:0}
 .head{display:flex;justify-content:space-between;align-items:baseline;
       font-size:11px;opacity:.65;letter-spacing:.08em;text-transform:uppercase;
       margin-bottom:14px}
 h2{font-size:16px;margin:0 0 12px;font-weight:600}
 p{margin:0 0 12px}
 .claim{border-left:2px solid var(--vscode-panel-border);padding:6px 0 6px 10px;
        margin:8px 0;font-size:13px}
 .k{display:inline-block;min-width:66px;font-size:10px;letter-spacing:.06em;
    text-transform:uppercase;opacity:.8}
 .tested .k{color:var(--vscode-testing-iconPassed)}
 .executed .k{color:var(--vscode-charts-blue)}
 .read .k{color:var(--vscode-descriptionForeground)}
 .inferred{border-left-color:var(--vscode-editorWarning-foreground)}
 .inferred .k{color:var(--vscode-editorWarning-foreground)}
 .ev{opacity:.6;font-size:12px;margin-top:3px}
 .q{margin-top:16px;padding-top:12px;border-top:1px solid var(--vscode-panel-border);
    font-size:13px}
 .bar{height:2px;background:var(--vscode-panel-border);margin:16px 0 0}
 .fill{height:2px;background:var(--vscode-charts-blue)}
</style>
<div class="head"><span>${index + 1} of ${n}</span>
  <span>${playing ? 'playing' : 'paused'} &middot; ${speed}x &middot; ~${remainingMinutes()} min</span></div>
<h2>${escapeHtml(step.title || '')}</h2>
<p>${escapeHtml(step.narration || '')}</p>
${claims}
${step.question ? `<div class="q"><b>A reviewer will ask:</b> ${escapeHtml(step.question)}</div>` : ''}
<div class="bar"><div class="fill" style="width:${((index + 1) / n) * 100}%"></div></div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function updateStatus() {
  if (!status) return;
  const n = tour.steps.length;
  status.text = `$(${playing ? 'debug-pause' : 'play'}) docent ${index + 1}/${n} · ~${remainingMinutes()}m`;
  status.tooltip = playing ? 'Docent is playing, click to pause' : 'Docent is paused, click to play';
  status.command = playing ? 'docent.pause' : 'docent.play';
  status.show();
}

function scheduleNext() {
  clearTimeout(timer);
  if (!playing) return;
  const step = tour.steps[index];
  if (!step) return;
  timer = setTimeout(async () => {
    if (index < tour.steps.length - 1) {
      index++;
      await render();
      scheduleNext();
    } else {
      playing = false;
      updateStatus();
      showNarration(tour.steps[index]);
    }
  }, holdFor(step));
}

async function openPanel() {
  if (panel) { panel.reveal(vscode.ViewColumn.Two, true); return; }
  panel = vscode.window.createWebviewPanel(
    'docent', 'Docent', { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
    { enableScripts: false, retainContextWhenHidden: true }
  );
  panel.onDidDispose(() => { panel = null; playing = false; clearTimeout(timer); updateStatus(); });
}

async function start() {
  if (!loadTour() || !tour.steps.length) {
    vscode.window.showWarningMessage('Docent: no .docent/tour.json in this workspace');
    return;
  }
  await openPanel();
  await render();
}

function activate(context) {
  dim = vscode.window.createTextEditorDecorationType({ opacity: '0.32', isWholeLine: true });
  spot = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor('editor.selectionHighlightBackground'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.infoForeground'),
    overviewRulerLane: vscode.OverviewRulerLane.Full,
  });
  cursorLine = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor('editorCodeLens.foreground'),
      fontStyle: 'italic',
      margin: '0 0 0 2em',
    },
  });

  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

  const r = root();
  if (r) {
    const w = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(r, '.docent/tour.json'));
    const reload = async () => { if (loadTour()) { await render(); if (playing) scheduleNext(); } };
    w.onDidChange(reload); w.onDidCreate(reload);
    context.subscriptions.push(w);
    if (loadTour() && tour.steps.length) updateStatus();
  }

  const cmd = (id, fn) => context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  cmd('docent.start', start);
  const setPlaying = (on) => {
    playing = on;
    clearTimeout(timer);
    updateStatus();
    if (tour.steps[index]) showNarration(tour.steps[index]);
    if (on) scheduleNext();
  };
  // One key toggles, so there is nothing to remember mid-tour.
  cmd('docent.play', async () => {
    if (!tour.steps.length && !loadTour()) return;
    if (!panel) await start();
    setPlaying(!playing);
  });
  cmd('docent.pause', () => setPlaying(false));
  cmd('docent.next', async () => {
    if (index < tour.steps.length - 1) { index++; await render(); if (playing) scheduleNext(); }
  });
  cmd('docent.prev', async () => {
    if (index > 0) { index--; await render(); if (playing) scheduleNext(); }
  });
  cmd('docent.faster', () => { speed = Math.min(4, speed * 2); setPlaying(playing); });
  cmd('docent.slower', () => { speed = Math.max(0.25, speed / 2); setPlaying(playing); });

  context.subscriptions.push(status, dim, spot, cursorLine);
}

function deactivate() { clearTimeout(timer); }

module.exports = { activate, deactivate };
