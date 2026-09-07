// Docent: plays a code tour. The editor scrolls itself, spotlights the lines
// being discussed, and narrates beside them with a transport the author drives.
//
// Reads .docent/tour.json from the workspace root and reloads on change, so
// the walk can rewrite the tour while it plays.

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

let tour = { steps: [], title: 'walkthrough' };
let index = 0;
let playing = false;
let speed = 1;
let timer = null;
let panel = null;
let status = null;
let chromeSent = false;   // the panel's HTML is written once, then fed state

let dim;        // everything outside the focus
let spot;       // the focused lines
let cursorLine; // the line the label attaches to

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
    // A tour half written by the walk is expected, not an error to interrupt
    // the author with. Keep what we have and try again on the next change.
    return tour.steps.length > 0;
  }
}

// How long a step is held. Reading is the constraint, so it scales with how
// much there is to take in, and speed divides it.
function holdMs(step) {
  const words = (step.narration || '').split(/\s+/).filter(Boolean).length;
  const lines = step.focus ? step.focus[1] - step.focus[0] + 1 : 1;
  const secs = Math.max(4, words / 3.0 + lines * 0.4);
  return (secs / speed) * 1000;
}

function remainingMinutes() {
  let ms = 0;
  for (let i = index; i < tour.steps.length; i++) ms += holdMs(tour.steps[i]);
  return Math.max(1, Math.round(ms / 60000));
}

async function render() {
  const step = tour.steps[index];
  if (!step) return;
  const r = root();
  const abs = path.isAbsolute(step.file) ? step.file : path.join(r, step.file);
  if (!fs.existsSync(abs)) { push(); return; }

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(abs));
  const editor = await vscode.window.showTextDocument(doc, {
    viewColumn: vscode.ViewColumn.One,
    preserveFocus: true,
    preview: true,
  });

  const last = doc.lineCount - 1;
  const from = Math.max(0, Math.min(last, (step.focus ? step.focus[0] : 1) - 1));
  const to = Math.max(from, Math.min(last, (step.focus ? step.focus[1] : from + 1) - 1));
  const focus = new vscode.Range(from, 0, to, doc.lineAt(to).text.length);

  // Spotlight: dim what is not being discussed so the eye has one place to go.
  const above = new vscode.Range(0, 0, Math.max(0, from - 1), 0);
  const below = new vscode.Range(Math.min(last, to + 1), 0, last, 0);
  editor.setDecorations(dim, from > 0 || to < last ? [above, below] : []);
  editor.setDecorations(spot, [focus]);

  const pointer = step.point ? Math.max(0, Math.min(last, step.point - 1)) : from;
  editor.setDecorations(cursorLine, step.label ? [{
    range: new vscode.Range(pointer, 0, pointer, doc.lineAt(pointer).text.length),
    renderOptions: { after: { contentText: `   ${step.label}` } },
  }] : []);

  editor.revealRange(focus, vscode.TextEditorRevealType.InCenter);
  push();
}

// State goes to the webview as a message rather than fresh HTML, so the
// transport keeps its focus and nothing flickers between steps.
function push() {
  updateStatus();
  if (!panel) return;
  if (!chromeSent) { panel.webview.html = chrome(); chromeSent = true; }
  const step = tour.steps[index] || {};
  panel.webview.postMessage({
    type: 'state',
    index, total: tour.steps.length, playing, speed,
    remaining: remainingMinutes(),
    titles: tour.steps.map((s) => s.title || ''),
    weak: tour.steps.map((s) => (s.claims || []).some((c) => c.class === 'inferred')),
    step: {
      title: step.title || '',
      narration: step.narration || '',
      claims: step.claims || [],
      question: step.question || '',
      where: step.file ? `${step.file}:${step.focus ? step.focus[0] : 1}` : '',
    },
  });
}

function chrome() {
  const nonce = String(Math.random()).slice(2);
  const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>
 :root{--gap:14px}
 body{font:14px/1.65 var(--vscode-font-family);color:var(--vscode-foreground);
      margin:0;display:flex;flex-direction:column;height:100vh}
 .bar{display:flex;align-items:center;gap:10px;padding:10px 14px;
      border-bottom:1px solid var(--vscode-panel-border);
      background:var(--vscode-editorWidget-background);flex:0 0 auto}
 button{font:inherit;font-size:12px;color:var(--vscode-button-secondaryForeground);
        background:var(--vscode-button-secondaryBackground);border:0;border-radius:4px;
        padding:4px 9px;cursor:pointer}
 button:hover{background:var(--vscode-button-secondaryHoverBackground)}
 #play{min-width:64px;color:var(--vscode-button-foreground);
       background:var(--vscode-button-background)}
 #play:hover{background:var(--vscode-button-hoverBackground)}
 select{font:inherit;font-size:12px;background:var(--vscode-dropdown-background);
        color:var(--vscode-dropdown-foreground);border:1px solid var(--vscode-dropdown-border);
        border-radius:4px;padding:3px 4px}
 #left{margin-left:auto;font-size:11px;opacity:.7;white-space:nowrap}
 #seek{display:flex;gap:2px;padding:0 14px 10px;flex:0 0 auto;
       border-bottom:1px solid var(--vscode-panel-border)}
 #seek div{height:6px;flex:1;border-radius:2px;cursor:pointer;
           background:var(--vscode-panel-border);transition:opacity .1s}
 #seek div:hover{opacity:.65}
 #seek div.done{background:var(--vscode-charts-blue)}
 #seek div.now{background:var(--vscode-charts-blue);height:10px;margin-top:-2px}
 #seek div.weak{box-shadow:inset 0 -3px 0 var(--vscode-editorWarning-foreground)}
 main{padding:16px 18px;overflow:auto;flex:1 1 auto}
 h2{font-size:16px;margin:0 0 4px;font-weight:600}
 .where{font-size:11px;opacity:.55;font-family:var(--vscode-editor-font-family);
        margin:0 0 14px}
 p{margin:0 0 14px}
 .claim{border-left:2px solid var(--vscode-panel-border);padding:6px 0 6px 10px;
        margin:8px 0;font-size:13px}
 .k{display:inline-block;min-width:68px;font-size:10px;letter-spacing:.06em;
    text-transform:uppercase;opacity:.85}
 .tested .k{color:var(--vscode-testing-iconPassed)}
 .executed .k{color:var(--vscode-charts-blue)}
 .read .k{color:var(--vscode-descriptionForeground)}
 .inferred{border-left-color:var(--vscode-editorWarning-foreground)}
 .inferred .k{color:var(--vscode-editorWarning-foreground)}
 .ev{opacity:.6;font-size:12px;margin-top:3px}
 .q{margin-top:18px;padding-top:12px;font-size:13px;
    border-top:1px solid var(--vscode-panel-border)}
</style></head><body>
<div class="bar">
  <button id="prev" title="previous step">&#9664;</button>
  <button id="play">Play</button>
  <button id="next" title="next step">&#9654;</button>
  <select id="speed" title="playback speed">
    <option value="0.5">0.5x</option><option value="1" selected>1x</option>
    <option value="2">2x</option><option value="4">4x</option>
  </select>
  <span id="left"></span>
</div>
<div id="seek"></div>
<main>
  <h2 id="title"></h2>
  <div class="where" id="where"></div>
  <p id="narration"></p>
  <div id="claims"></div>
  <div id="question"></div>
</main>
<script nonce="${nonce}">
const vs = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
$('play').onclick = () => vs.postMessage({type:'toggle'});
$('next').onclick = () => vs.postMessage({type:'next'});
$('prev').onclick = () => vs.postMessage({type:'prev'});
$('speed').onchange = (e) => vs.postMessage({type:'speed', value: parseFloat(e.target.value)});

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const order = ['tested','executed','read','inferred'];

window.addEventListener('message', (ev) => {
  const s = ev.data;
  if (s.type !== 'state') return;
  $('play').textContent = s.playing ? 'Pause' : 'Play';
  $('speed').value = String(s.speed);
  $('left').textContent = (s.index+1) + ' of ' + s.total + '  ·  ~' + s.remaining + ' min left';
  $('prev').disabled = s.index === 0;
  $('next').disabled = s.index >= s.total - 1;

  // One segment per step: click to seek, and a step resting on weak evidence
  // is marked so it is visible before you get there.
  const seek = $('seek');
  seek.innerHTML = '';
  for (let i = 0; i < s.total; i++) {
    const d = document.createElement('div');
    d.className = (i === s.index ? 'now' : i < s.index ? 'done' : '') + (s.weak[i] ? ' weak' : '');
    d.title = (i+1) + '. ' + s.titles[i];
    d.onclick = () => vs.postMessage({type:'seek', index:i});
    seek.appendChild(d);
  }

  $('title').textContent = s.step.title;
  $('where').textContent = s.step.where;
  $('narration').textContent = s.step.narration;
  const claims = (s.step.claims || []).slice().sort(
    (a,b) => order.indexOf(a.class) - order.indexOf(b.class));
  $('claims').innerHTML = claims.map(c =>
    '<div class="claim ' + esc(c.class||'inferred') + '"><span class="k">' +
    esc(c.class||'inferred') + '</span>' + esc(c.text) +
    (c.evidence ? '<div class="ev">' + esc(c.evidence) + '</div>' : '') + '</div>').join('');
  $('question').innerHTML = s.step.question
    ? '<div class="q"><b>A reviewer will ask:</b> ' + esc(s.step.question) + '</div>' : '';
});
</script></body></html>`;
}

function updateStatus() {
  if (!status) return;
  status.text = `$(${playing ? 'debug-pause' : 'play'}) docent ${index + 1}/${tour.steps.length} · ~${remainingMinutes()}m`;
  status.tooltip = playing ? 'Docent is playing, click to pause' : 'Docent is paused, click to play';
  status.command = 'docent.play';
  status.show();
}

function schedule() {
  clearTimeout(timer);
  if (!playing || !tour.steps[index]) return;
  timer = setTimeout(async () => {
    if (index < tour.steps.length - 1) { index++; await render(); schedule(); }
    else { playing = false; push(); }
  }, holdMs(tour.steps[index]));
}

function setPlaying(on) {
  playing = on;
  clearTimeout(timer);
  push();
  if (on) schedule();
}

async function goto(i) {
  if (i < 0 || i >= tour.steps.length) return;
  index = i;
  await render();
  if (playing) schedule();
}

async function openPanel() {
  if (panel) { panel.reveal(vscode.ViewColumn.Two, true); return; }
  panel = vscode.window.createWebviewPanel(
    'docent', 'Docent', { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
    { enableScripts: true, retainContextWhenHidden: true }
  );
  chromeSent = false;
  panel.onDidReceiveMessage(async (m) => {
    if (m.type === 'toggle') setPlaying(!playing);
    else if (m.type === 'next') await goto(index + 1);
    else if (m.type === 'prev') await goto(index - 1);
    else if (m.type === 'seek') await goto(m.index);
    else if (m.type === 'speed') { speed = m.value; setPlaying(playing); }
  });
  panel.onDidDispose(() => {
    panel = null; chromeSent = false; playing = false;
    clearTimeout(timer); updateStatus();
  });
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
    const reload = async () => { if (loadTour()) { await render(); if (playing) schedule(); } };
    w.onDidChange(reload); w.onDidCreate(reload);
    context.subscriptions.push(w);
    if (loadTour() && tour.steps.length) updateStatus();
  }

  const cmd = (id, fn) => context.subscriptions.push(vscode.commands.registerCommand(id, fn));
  cmd('docent.start', start);
  cmd('docent.play', async () => {
    if (!tour.steps.length && !loadTour()) return;
    if (!panel) await start();
    setPlaying(!playing);
  });
  cmd('docent.pause', () => setPlaying(false));
  cmd('docent.next', () => goto(index + 1));
  cmd('docent.prev', () => goto(index - 1));
  cmd('docent.faster', () => { speed = Math.min(4, speed * 2); setPlaying(playing); });
  cmd('docent.slower', () => { speed = Math.max(0.5, speed / 2); setPlaying(playing); });

  context.subscriptions.push(status, dim, spot, cursorLine);
}

function deactivate() { clearTimeout(timer); }

module.exports = { activate, deactivate };
