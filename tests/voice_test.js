// Drives the extension against a stubbed editor, because the things that go
// wrong here only go wrong at runtime: a step that advances before the voice
// finishes, a tour's text reaching a shell, a reload restarting a sentence.
//
// The stub is deliberately thin. It answers what extension.js actually calls
// and nothing else, so a new call site shows up as a missing stub, not a pass.

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Module = require('module');
const { EventEmitter } = require('events');

const repo = path.join(os.tmpdir(), 'docent-voice-test');
fs.rmSync(repo, { recursive: true, force: true });
fs.mkdirSync(path.join(repo, '.docent'), { recursive: true });
fs.writeFileSync(path.join(repo, 'a.go'), Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join('\n'));

const tour = {
  version: 1,
  title: 'PR 412',
  steps: [
    { file: 'a.go', focus: [3, 6], point: 4, title: 'openOnce holds the mutex', narration: '-leading dash and `ticks`.' },
    { file: 'a.go', focus: [9, 12], point: 10, title: 'second', narration: 'second stop.' },
  ],
};
const tourPath = path.join(repo, '.docent', 'tour.json');
fs.writeFileSync(tourPath, JSON.stringify(tour, null, 2));

// --- the stubs -------------------------------------------------------------

const spawned = [];
const cp = require('child_process');
cp.spawn = (cmd, args) => {
  const child = new EventEmitter();
  child.kill = () => { child.killed = true; child.emit('close', null, 'SIGTERM'); };
  spawned.push({ cmd, args, child });
  return child;
};

let panelMessages = [];
let webviewHandler = null;
let panelDisposeHandler = null;
let warnings = [];
let watchHandler = null;
let config = { speak: true, voice: '' };
const commands = {};
const noop = () => ({ dispose() {} });

const vscode = {
  ViewColumn: { One: 1, Two: 2 },
  StatusBarAlignment: { Left: 1 },
  OverviewRulerLane: { Full: 7 },
  TextEditorRevealType: { InCenter: 2 },
  ThemeColor: class { constructor(id) { this.id = id; } },
  Range: class { constructor(a, b, c, d) { Object.assign(this, { a, b, c, d }); } },
  RelativePattern: class { constructor(base, pat) { Object.assign(this, { base, pat }); } },
  window: {
    createTextEditorDecorationType: () => ({ dispose() {} }),
    createStatusBarItem: () => ({ show() {}, dispose() {} }),
    showTextDocument: async () => ({ setDecorations() {}, revealRange() {} }),
    showWarningMessage: (m) => { warnings.push(m); return Promise.resolve(); },
    showInformationMessage: () => Promise.resolve(undefined),
    setStatusBarMessage: () => {},
    createWebviewPanel: () => {
      const p = {
        webview: {
          set html(_) {},
          postMessage: (m) => { panelMessages.push(m); },
          onDidReceiveMessage: (h) => { webviewHandler = h; return { dispose() {} }; },
        },
        onDidDispose: (h) => { panelDisposeHandler = h; return { dispose() {} }; },
        reveal() {},
      };
      return p;
    },
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: repo } }],
    getConfiguration: () => ({ get: (k, d) => (k in config ? config[k] : d) }),
    createFileSystemWatcher: () => ({
      onDidChange: (h) => { watchHandler = h; return { dispose() {} }; },
      onDidCreate: noop,
      dispose() {},
    }),
    openTextDocument: async (uri) => {
      const lines = fs.readFileSync(uri.fsPath, 'utf8').split('\n');
      return { lineCount: lines.length, lineAt: (n) => ({ text: lines[n] || '' }) };
    },
  },
  commands: {
    registerCommand: (id, fn) => { commands[id] = fn; return { dispose() {} }; },
    executeCommand: (id) => commands[id] && commands[id](),
  },
  Uri: { file: (p) => ({ fsPath: p }) },
};

const load = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'vscode') return vscode;
  return load.apply(this, [req, ...rest]);
};

const ext = require('../editor/vscode/extension.js');
ext.activate({ subscriptions: [], globalState: { get: (_, d) => d, update() {} } });

// --- the assertions --------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const last = () => spawned[spawned.length - 1];
const state = () => panelMessages[panelMessages.length - 1];
let n = 0;
const ok = (what) => { n++; console.log(`  ok ${what}`); };

(async () => {
  await commands['docent.start']();
  assert.equal(spawned.length, 0, 'opening a tour must not start talking on its own');
  ok('opening the tour is silent until play');

  await commands['docent.play']();
  await sleep(50);
  assert.equal(spawned.length, 1, 'play should start the voice');

  const { cmd, args } = last();
  assert.equal(cmd, process.platform === 'linux' ? 'spd-say' : 'say');
  // The text is one argument after --, so a narration starting with a dash is
  // text and not an option. spawn gets an array, so no shell parses it either.
  const dd = args.indexOf('--');
  assert.ok(dd > -1 && dd === args.length - 2, `-- must be the last flag: ${args}`);
  const said = args[args.length - 1];
  assert.ok(said.startsWith('-leading') === false, 'text must not be an option');
  ok('the tour text goes after -- as a single argument');

  assert.ok(said.startsWith('PR 412.'), `tour title announced first: ${said}`);
  assert.ok(said.includes('open Once'), `camel case is split for the ear: ${said}`);
  assert.ok(!said.includes('`'), 'markdown ticks are not read out');
  ok('title, then step title with camel case split, no ticks');

  // The step must wait for the voice. holdMs for this step is about 4s, so a
  // long silence proves nothing; the close event is what has to move it.
  await sleep(300);
  assert.equal(state().index, 0, 'a step must not advance while the voice is talking');
  ok('a talking step does not advance');

  // The walk rewrites the tour while it plays. A reload must not restart a
  // sentence whose text did not change.
  await watchHandler();
  await sleep(50);
  assert.equal(spawned.length, 1, 'a reload restarted a sentence that had not changed');
  ok('a tour reload does not restart the current sentence');

  // tailMs holds a four line focus for 1.6s after the voice stops, so the eye
  // can finish the lines it was talking about.
  last().child.emit('close', 0, null);
  await sleep(300);
  assert.equal(state().index, 0, 'the beat after the voice is part of the step');
  await sleep(1800);
  assert.equal(state().index, 1, 'the step should advance once the voice finishes');
  assert.equal(spawned.length, 2, 'the next step should be read too');
  assert.ok(!spawned[1].args[spawned[1].args.length - 1].includes('PR 412'),
    'the tour title is announced once, not at every stop');
  ok('close advances, and the title is not repeated');

  // Pause has to silence the voice, not just stop the clock.
  commands['docent.pause']();
  assert.ok(spawned[1].child.killed, 'pause must stop the sentence in progress');
  ok('pause kills the voice');

  // Toggling off and stepping by hand stays silent; toggling on reads the stop
  // you are already on.
  const before = spawned.length;
  commands['docent.voice']();
  await commands['docent.prev']();
  await sleep(50);
  assert.equal(spawned.length, before, 'with the voice off, stepping must be silent');
  commands['docent.voice']();
  await sleep(50);
  assert.equal(spawned.length, before + 1, 'turning the voice on reads the current stop');
  ok('the toggle silences and resumes on the stop you are on');

  // A missing command downgrades to the reading timer instead of hanging.
  last().child.emit('close', 0, null);
  await sleep(20);
  spawned.length = 0;
  warnings = [];
  await commands['docent.play']();
  await sleep(20);
  last().child.emit('error', Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
  await sleep(50);
  assert.equal(warnings.length, 1, `a missing voice must be reported once: ${warnings}`);
  const at = state().index;
  await sleep(5000);
  assert.ok(state().index > at, 'without a voice the tour must fall back to the timer');
  ok('a missing voice command falls back to timed steps');

  panelDisposeHandler();
  console.log(`ok: voice_test (${n} checks)`);
  process.exit(0);
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
