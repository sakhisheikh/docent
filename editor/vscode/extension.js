// Docent: plays a code tour. The editor scrolls itself, spotlights the lines
// being discussed, and narrates beside them with a transport the author drives.
//
// Reads .docent/tour.json from the workspace root and reloads on change, so
// the walk can rewrite the tour while it plays.

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let tour = { steps: [], title: 'walkthrough' };
let index = 0;
let playing = false;
let speed = 1;
let timer = null;
let panel = null;
let status = null;
let chromeSent = false;   // the panel's HTML is written once, then fed state

let speaking = true;      // whether to read each stop out loud
let voice = null;         // the running speech process, if any
let voiceText = '';       // what it is saying, so a reload does not restart it
let saidTitle = false;    // the tour's own title is announced once, not per stop

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

const BASE_WPM = 180;   // also holdMs's assumed reading pace, so estimates agree

function cfg(key, fallback) {
  return vscode.workspace.getConfiguration('docent').get(key, fallback);
}

// The title and the narration, which is what the panel puts on screen. Claims
// stay on the page: an evidence class read out loud is noise, not a sentence.
function speechText(step) {
  const parts = [];
  if (step.title) parts.push(step.title);
  if (step.narration) parts.push(step.narration);
  return parts.join('. ')
    // A voice says openOnce as one slurred word, so the case boundary
    // becomes a space. Markdown ticks are read out as characters.
    .replace(/[`*_]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

// spawn gets an argument array and no shell, so text from a tour cannot become
// a command. Returns null where the platform has no voice we can drive.
function speechArgs(text) {
  if (process.platform === 'darwin') {
    const v = cfg('voice', '');
    const flags = (v ? ['-v', v] : []).concat(['-r', String(Math.round(BASE_WPM * speed))]);
    return ['say', flags.concat(['--', text])];
  }
  if (process.platform === 'linux') {
    const rate = Math.max(-100, Math.min(100, Math.round((speed - 1) * 50)));
    return ['spd-say', ['-r', String(rate), '-w', '--', text]];
  }
  return null;
}

function stopSpeaking() {
  if (!voice) return;
  const v = voice;
  voice = null;
  voiceText = '';
  v.kill();
}

// Calls done(spoke) once. spoke is false when there was nothing to say or no
// voice to say it with, which is the caller's cue to fall back to the timer.
function speak(step, done) {
  const text = speaking ? speechText(step) : '';
  // The walk rewrites the tour while it plays, and a reload should not restart
  // a sentence that has not changed. The running voice keeps its own callback.
  if (voice && text && text === voiceText) return;
  stopSpeaking();
  let spoken = text;
  if (text && !saidTitle && tour.title) {
    spoken = `${tour.title}. ${text}`;
    saidTitle = true;
  }
  const args = spoken ? speechArgs(spoken) : null;
  if (!args) { done(false); return; }

  let child;
  try {
    child = spawn(args[0], args[1]);
  } catch (e) {
    speaking = false;
    done(false);
    return;
  }
  voice = child;
  voiceText = text;   // the step alone, not the announced tour title
  let settled = false;
  const settle = (spoke) => {
    if (settled) return;
    settled = true;
    if (voice === child) voice = null;
    done(spoke);
  };
  child.on('error', () => {
    // No such command on this machine. Stop trying for the rest of the session
    // rather than sitting in silence at every stop.
    speaking = false;
    vscode.window.showWarningMessage(
      `Docent: ${args[0]} is not available, so stops will not be read out loud`);
    push();
    settle(false);
  });
  // A killed process closes too, but only the current one advances the tour.
  child.on('close', () => { if (voice === child) settle(true); });
}

// A beat after the voice stops, so the eye can finish the lines it was talking
// about before the tour moves on.
function tailMs(step) {
  const lines = step.focus ? step.focus[1] - step.focus[0] + 1 : 1;
  return Math.min(6000, lines * 400) / speed;
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
  const shift = relocate(doc, step);
  if (shift !== 0 && step.focus) {
    step.focus = [step.focus[0] + shift, step.focus[1] + shift];
    if (step.point) step.point += shift;
  }
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

// How far the anchor has moved since the tour was written. Returns 0 when there
// is no anchor, when it is still where the tour says, or when it cannot be
// found at all: a wrong highlight is better than jumping somewhere arbitrary,
// and driftedAway reports the last case so the panel can say so.
let driftedAway = false;

function relocate(doc, step) {
  driftedAway = false;
  if (!step.anchor || !step.point) return 0;
  const at = step.point - 1;
  const has = (n) => n >= 0 && n <= doc.lineCount - 1 &&
    doc.lineAt(n).text.includes(step.anchor);
  if (has(at)) return 0;

  // Search outwards, so the nearest match wins when a snippet repeats.
  for (let d = 1; d <= 200; d++) {
    if (has(at - d)) return -d;
    if (has(at + d)) return d;
  }
  driftedAway = true;
  return 0;
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
    index, total: tour.steps.length, playing, speed, speaking,
    remaining: remainingMinutes(),
    titles: tour.steps.map((s) => s.title || ''),
    files: tour.steps.map((s) => path.basename(s.file || '')),
    kinds: tour.steps.map((s) => s.kind || 'decision'),
    weak: tour.steps.map((s) => (s.claims || []).some((c) => c.class === 'inferred')),
    step: {
      title: step.title || '',
      narration: step.narration || '',
      claims: step.claims || [],
      question: step.question || '',
      where: step.file ? `${step.file}:${step.focus ? step.focus[0] : 1}` : '',
      kind: step.kind || 'decision',
      drifted: driftedAway,
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
 #seek{display:flex;gap:9px;padding:2px 14px 10px;flex:0 0 auto;align-items:flex-end;
       border-bottom:1px solid var(--vscode-panel-border)}
 .grp{display:flex;flex-direction:column;gap:3px;min-width:0}
 .lbl{font-size:9.5px;letter-spacing:.02em;opacity:.45;white-space:nowrap;
      overflow:hidden;text-overflow:ellipsis;font-family:var(--vscode-editor-font-family)}
 .grp.here .lbl{opacity:1;color:var(--vscode-charts-blue)}
 .segs{display:flex;gap:2px}
 .segs i{height:6px;flex:1;min-width:5px;border-radius:2px;cursor:pointer;
         background:var(--vscode-panel-border);transition:opacity .1s}
 .segs i:hover{opacity:.6}
 .segs i.mech{background:var(--vscode-panel-border);opacity:.55}
 .segs i.done{background:var(--vscode-charts-blue);opacity:1}
 .segs i.done.mech{opacity:.5}
 .segs i.now{background:var(--vscode-charts-blue);height:11px;margin-top:-5px;opacity:1}
 .segs i.weak{box-shadow:inset 0 -3px 0 var(--vscode-editorWarning-foreground)}
 main{padding:16px 18px;overflow:auto;flex:1 1 auto}
 h2{font-size:16px;margin:0 0 4px;font-weight:600}
 .where{font-size:11px;opacity:.55;font-family:var(--vscode-editor-font-family);
        margin:0 0 14px}
 p{margin:0 0 14px}
 .claim{border-left:2px solid var(--vscode-panel-border);padding:6px 0 6px 10px;
        margin:8px 0;font-size:13px}
 .k{display:inline-block;min-width:64px;margin-right:8px;font-size:10px;
    letter-spacing:.06em;text-transform:uppercase;opacity:.85}
 .tested .k{color:var(--vscode-testing-iconPassed)}
 .executed .k{color:var(--vscode-charts-blue)}
 .read .k{color:var(--vscode-descriptionForeground)}
 .inferred{border-left-color:var(--vscode-editorWarning-foreground)}
 .inferred .k{color:var(--vscode-editorWarning-foreground)}
 .ev{opacity:.6;font-size:12px;margin-top:3px}
 .q{margin-top:18px;padding-top:12px;font-size:13px;
    border-top:1px solid var(--vscode-panel-border)}
 .ed{background:none;border:0;padding:0 4px;margin-left:6px;cursor:pointer;
     font-size:11px;opacity:.35;color:var(--vscode-foreground);vertical-align:middle}
 .ed:hover{opacity:1;background:none}
 textarea,.cls{font:inherit;font-size:13px;width:100%;box-sizing:border-box;
   background:var(--vscode-input-background);color:var(--vscode-input-foreground);
   border:1px solid var(--vscode-focusBorder);border-radius:4px;padding:6px 8px;
   margin:4px 0;resize:vertical}
 .cls{width:auto;font-size:12px;padding:3px 4px}
 .row{display:flex;gap:6px;align-items:center;margin:4px 0}
 .row button{font-size:11px}
 .hint{font-size:11px;opacity:.5;margin-top:20px;padding-top:10px;
       border-top:1px solid var(--vscode-panel-border)}
 .hint a{color:var(--vscode-textLink-foreground);cursor:pointer}
</style></head><body>
<div class="bar">
  <button id="prev" title="previous step">&#9664;</button>
  <button id="play">Play</button>
  <button id="next" title="next step">&#9654;</button>
  <select id="speed" title="playback speed">
    <option value="0.5">0.5x</option><option value="1" selected>1x</option>
    <option value="2">2x</option><option value="4">4x</option>
  </select>
  <button id="voice" title="read each stop out loud">&#128266;</button>
  <span id="left"></span>
</div>
<div id="seek"></div>
<main>
  <h2><span id="title"></span><button class="ed" id="edTitle" title="edit the title">&#9998;</button></h2>
  <div class="where" id="where"></div>
  <div id="narration"></div>
  <div id="claims"></div>
  <div id="question"></div>
  <div class="hint">Every field here is editable and saves straight to
    <a id="openRaw">.docent/tour.json</a>.</div>
</main>
<script nonce="${nonce}">
const vs = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
$('play').onclick = () => vs.postMessage({type:'toggle'});
$('next').onclick = () => vs.postMessage({type:'next'});
$('prev').onclick = () => vs.postMessage({type:'prev'});
$('speed').onchange = (e) => vs.postMessage({type:'speed', value: parseFloat(e.target.value)});
$('voice').onclick = () => vs.postMessage({type:'voice'});

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const order = ['tested','executed','read','inferred'];

window.addEventListener('message', (ev) => {
  const s = ev.data;
  if (s.type !== 'state') return;
  $('play').textContent = s.playing ? 'Pause' : 'Play';
  $('speed').value = String(s.speed);
  $('voice').textContent = s.speaking ? '\u{1F50A}' : '\u{1F507}';
  $('voice').title = s.speaking ? 'stop reading stops out loud' : 'read each stop out loud';
  $('left').textContent = (s.index+1) + ' of ' + s.total + '  ·  ~' + s.remaining + ' min left';
  $('prev').disabled = s.index === 0;
  $('next').disabled = s.index >= s.total - 1;

  // Group consecutive steps by file, so the bar reads as a map of the change
  // rather than a row of anonymous ticks. Each group is as wide as the number
  // of steps that file earned.
  const groups = [];
  for (let i = 0; i < s.total; i++) {
    const f = s.files[i] || '';
    const g = groups[groups.length - 1];
    if (g && g.file === f) g.idx.push(i);
    else groups.push({ file: f, idx: [i] });
  }

  const seek = $('seek');
  seek.innerHTML = '';
  for (const g of groups) {
    const wrap = document.createElement('div');
    wrap.className = 'grp' + (g.idx.includes(s.index) ? ' here' : '');
    wrap.style.flex = String(g.idx.length);

    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.textContent = g.file;
    lbl.title = g.file + '  ·  ' + g.idx.length + (g.idx.length === 1 ? ' step' : ' steps');
    wrap.appendChild(lbl);

    const segs = document.createElement('div');
    segs.className = 'segs';
    for (const i of g.idx) {
      const it = document.createElement('i');
      it.className = [
        i === s.index ? 'now' : i < s.index ? 'done' : '',
        s.kinds[i] !== 'decision' ? 'mech' : '',
        s.weak[i] ? 'weak' : '',
      ].filter(Boolean).join(' ');
      it.title = (i + 1) + '. ' + s.titles[i] +
        (s.kinds[i] !== 'decision' ? '  (' + s.kinds[i] + ')' : '');
      it.onclick = () => vs.postMessage({ type: 'seek', index: i });
      segs.appendChild(it);
    }
    wrap.appendChild(segs);
    seek.appendChild(wrap);
  }

  cur = s;
  $('title').textContent = s.step.title;
  $('where').textContent = s.step.where +
    (s.step.kind && s.step.kind !== 'decision' ? '   ·   ' + s.step.kind : '') +
    (s.step.drifted ? '   ·   anchor not found, the highlight may be stale' : '');

  $('narration').innerHTML = '<p>' + esc(s.step.narration) +
    '<button class="ed" data-f="narration" title="edit">&#9998;</button></p>';

  // Claims keep their original positions in the file, so an edit targets the
  // right one even though they are displayed strongest first.
  const claims = (s.step.claims || [])
    .map((c, i) => ({ c, i }))
    .sort((a, b) => order.indexOf(a.c.class) - order.indexOf(b.c.class));
  $('claims').innerHTML = claims.map(({ c, i }) =>
    '<div class="claim ' + esc(c.class||'inferred') + '">' +
    '<span class="k">' + esc(c.class||'inferred') + '</span>' + esc(c.text) +
    '<button class="ed" data-f="claim" data-i="' + i + '" data-p="text" title="edit the claim">&#9998;</button>' +
    '<div class="ev">' + esc(c.evidence || 'no evidence recorded') +
    '<button class="ed" data-f="claim" data-i="' + i + '" data-p="evidence" title="edit the evidence">&#9998;</button>' +
    '<button class="ed" data-f="claim" data-i="' + i + '" data-p="class" title="change the evidence class">&#9670;</button>' +
    '</div></div>').join('');

  $('question').innerHTML = '<div class="q"><b>A reviewer will ask:</b> ' +
    esc(s.step.question || 'nothing recorded') +
    '<button class="ed" data-f="question" title="edit">&#9998;</button></div>';

  document.querySelectorAll('.ed[data-f]').forEach(b => {
    b.onclick = () => openEditor(b);
  });
});

let cur = null;
$('edTitle').onclick = () => openEditor($('edTitle'), 'title');
$('openRaw').onclick = () => vs.postMessage({type:'reveal'});

// Replace the clicked block with an input, so editing happens where the text is
// rather than in a dialog away from it.
function openEditor(btn, forced) {
  if (!cur) return;
  const field = forced || btn.dataset.f;
  const ci = btn.dataset.i !== undefined ? parseInt(btn.dataset.i, 10) : undefined;
  const part = btn.dataset.p;
  const step = cur.step;

  let value = '';
  if (field === 'claim') {
    const c = (step.claims || [])[ci] || {};
    value = part === 'class' ? (c.class || 'inferred') : (c[part] || '');
  } else {
    value = step[field] || '';
  }

  const host = btn.parentElement;
  const original = host.innerHTML;
  host.innerHTML = '';

  let input;
  if (part === 'class') {
    input = document.createElement('select');
    input.className = 'cls';
    for (const k of order) {
      const o = document.createElement('option');
      o.value = k; o.textContent = k; if (k === value) o.selected = true;
      input.appendChild(o);
    }
  } else {
    input = document.createElement('textarea');
    input.rows = field === 'narration' ? 6 : 2;
    input.value = value;
  }
  host.appendChild(input);

  const row = document.createElement('div');
  row.className = 'row';
  const save = document.createElement('button');
  save.textContent = 'Save';
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  row.appendChild(save); row.appendChild(cancel);
  host.appendChild(row);
  input.focus();

  cancel.onclick = () => { host.innerHTML = original;
    host.querySelectorAll('.ed[data-f]').forEach(b => { b.onclick = () => openEditor(b); }); };
  save.onclick = () => vs.postMessage({
    type: 'edit', index: cur.index, field, claim: ci, part, value: input.value,
  });
  // Enter saves a one-liner; a narration needs Enter for paragraphs.
  input.onkeydown = (e) => {
    if (e.key === 'Escape') cancel.onclick();
    if (e.key === 'Enter' && (field !== 'narration' || e.metaKey || e.ctrlKey)) {
      e.preventDefault(); save.onclick();
    }
  };
}
</script></body></html>`;
}

function updateStatus() {
  if (!status) return;
  status.text = `$(${playing ? 'debug-pause' : 'play'}) docent ${index + 1}/${tour.steps.length} · ~${remainingMinutes()}m`;
  status.tooltip = playing ? 'Docent is playing, click to pause' : 'Docent is paused, click to play';
  status.command = 'docent.play';
  status.show();
}

async function advance() {
  if (index < tour.steps.length - 1) { index++; await render(); schedule(); }
  else { playing = false; stopSpeaking(); push(); }
}

// When a stop is read out loud, the voice sets the pace: the step ends when the
// sentence does, so nothing is cut off and no step sits in silence. Without a
// voice the word count is all there is to go on.
function schedule() {
  clearTimeout(timer);
  if (!playing || !tour.steps[index]) return;
  const step = tour.steps[index];
  const at = index;
  speak(step, (spoke) => {
    if (!playing || index !== at) return;
    timer = setTimeout(advance, spoke ? tailMs(step) : holdMs(step));
  });
}

function setPlaying(on) {
  playing = on;
  clearTimeout(timer);
  if (!on) stopSpeaking();
  push();
  if (on) schedule();
}

async function goto(i) {
  if (i < 0 || i >= tour.steps.length) return;
  index = i;
  await render();
  if (playing) { schedule(); return; }
  // Stepping by hand while paused still reads the stop, because listening to
  // one stop and staying on it is the whole point of stepping by hand.
  stopSpeaking();
  speak(tour.steps[index], () => {});
}

let selfWrite = false;

function tourPath() {
  const r = root();
  return r ? path.join(r, '.docent', 'tour.json') : null;
}

// Apply one edit and persist. Re-reads the file so an edit does not overwrite
// changes the walk made while the panel was open.
function applyEdit(m) {
  const p = tourPath();
  if (!p) return;
  let disk;
  try {
    disk = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    vscode.window.showErrorMessage('Docent: tour.json is not readable, edit not saved');
    return;
  }
  const step = (disk.steps || [])[m.index];
  if (!step) return;

  if (m.field === 'title' || m.field === 'narration' || m.field === 'question') {
    if (m.value.trim()) step[m.field] = m.value.trim();
    else delete step[m.field];
  } else if (m.field === 'claim') {
    const c = (step.claims || [])[m.claim];
    if (!c) return;
    if (m.part === 'class') c.class = m.value;
    else if (m.value.trim()) c[m.part] = m.value.trim();
    else delete c[m.part];
  }

  selfWrite = true;
  fs.writeFileSync(p, JSON.stringify(disk, null, 2) + '\n');
  tour = { steps: disk.steps || [], title: disk.title || 'walkthrough' };
  push();
  vscode.window.setStatusBarMessage('Docent: saved to tour.json', 1500);
}

// Turning the voice off stops the sentence in progress. Turning it on starts
// reading the stop you are already on rather than waiting for the next one.
function toggleVoice() {
  speaking = !speaking;
  stopSpeaking();
  if (playing) schedule();
  else if (speaking && tour.steps[index]) speak(tour.steps[index], () => {});
  push();
}

async function openPanel() {
  if (panel) { panel.reveal(vscode.ViewColumn.Two, true); return; }
  panel = vscode.window.createWebviewPanel(
    'docent', 'Docent', { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
    { enableScripts: true, retainContextWhenHidden: true }
  );
  chromeSent = false;
  // onDidReceiveMessage is on the webview, not the panel. onDidDispose is on
  // the panel. Getting that wrong throws before the HTML is ever written.
  panel.webview.onDidReceiveMessage(async (m) => {
    if (m.type === 'toggle') setPlaying(!playing);
    else if (m.type === 'next') await goto(index + 1);
    else if (m.type === 'prev') await goto(index - 1);
    else if (m.type === 'seek') await goto(m.index);
    else if (m.type === 'speed') { speed = m.value; setPlaying(playing); }
    else if (m.type === 'voice') toggleVoice();
    else if (m.type === 'edit') { setPlaying(false); applyEdit(m); }
    else if (m.type === 'reveal') {
      const p = tourPath();
      if (p) vscode.window.showTextDocument(vscode.Uri.file(p), { preview: false });
    }
  });
  panel.onDidDispose(() => {
    panel = null; chromeSent = false; playing = false;
    clearTimeout(timer); stopSpeaking(); updateStatus();
  });
}

async function start() {
  saidTitle = false;
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
  speaking = cfg('speak', true);

  const r = root();
  if (r) {
    const w = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(r, '.docent/tour.json'));
    const reload = async () => {
      if (selfWrite) { selfWrite = false; return; }
      if (loadTour()) { await render(); if (playing) schedule(); }
    };
    w.onDidChange(reload); w.onDidCreate(reload);
    context.subscriptions.push(w);
    if (loadTour() && tour.steps.length) {
      updateStatus();
      const key = 'docent.announced';
      const seen = context.globalState.get(key, []);
      const id = r + ':' + tour.steps.length;
      if (!seen.includes(id)) {
        context.globalState.update(key, seen.concat([id]).slice(-40));
        vscode.window.showInformationMessage(
          `Docent: this branch ships a ${tour.steps.length} step tour of the change`,
          'Play it'
        ).then((pick) => { if (pick === 'Play it') vscode.commands.executeCommand('docent.play'); });
      }
    }
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
  cmd('docent.voice', toggleVoice);

  context.subscriptions.push(status, dim, spot, cursorLine);
}

function deactivate() { clearTimeout(timer); stopSpeaking(); }

module.exports = { activate, deactivate };
