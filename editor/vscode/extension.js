// Docent: shows review notes as hovers on the lines they are about.
//
// Reads .docent/notes.json from the workspace root and reloads whenever it
// changes, so the walk can move the review along and the editor keeps up. It
// never modifies a file: the notes live beside the repo, not in it.

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

// Evidence classes, in the order they should appear in a hover: strongest
// first, so the eye lands on what is proven before what is guessed.
const CLASS_ORDER = ['tested', 'executed', 'read', 'inferred'];
const CLASS_MARK = {
  tested: '$(pass-filled)',
  executed: '$(play-circle)',
  read: '$(eye)',
  inferred: '$(question)',
};

let notes = {};            // relative path -> { line -> note }
let enabled = true;
let noteDecoration;
let weakDecoration;

function workspaceRoot() {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length ? folders[0].uri.fsPath : null;
}

function notesPath() {
  const root = workspaceRoot();
  return root ? path.join(root, '.docent', 'notes.json') : null;
}

function load() {
  const p = notesPath();
  notes = {};
  if (!p || !fs.existsSync(p)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    notes = raw.files || {};
  } catch (err) {
    // A half-written file during a walk is expected, not an error worth
    // interrupting the author for. Keep the previous notes and try again on
    // the next change event.
    console.warn('docent: could not parse notes.json:', err.message);
  }
}

function notesFor(document) {
  const root = workspaceRoot();
  if (!root || !enabled) return null;
  const rel = path.relative(root, document.uri.fsPath);
  return notes[rel] || null;
}

// A hover: the note, then any claims with their evidence, weakest last so the
// reader finishes on the thing most worth arguing with.
function buildHover(entry) {
  const md = new vscode.MarkdownString();
  md.supportThemeIcons = true;
  md.isTrusted = true;

  if (entry.note) md.appendMarkdown(`${entry.note}\n\n`);

  const claims = (entry.claims || []).slice().sort(
    (a, b) => CLASS_ORDER.indexOf(a.class) - CLASS_ORDER.indexOf(b.class)
  );
  for (const c of claims) {
    const mark = CLASS_MARK[c.class] || '';
    md.appendMarkdown(`${mark} **${c.class}** ${c.text}`);
    if (c.evidence) md.appendMarkdown(`\n\n&nbsp;&nbsp;&nbsp;*${c.evidence}*`);
    md.appendMarkdown('\n\n');
  }

  if (entry.question) {
    md.appendMarkdown(`---\n\n**A reviewer will ask:** ${entry.question}\n`);
  }
  return new vscode.Hover(md);
}

// Marks which lines carry a note, so the author can see where to hover without
// sweeping the file. Weak evidence gets a different mark: those are the lines
// worth stopping on.
function paint(editor) {
  if (!editor) return;
  const forFile = notesFor(editor.document);
  if (!forFile) {
    editor.setDecorations(noteDecoration, []);
    editor.setDecorations(weakDecoration, []);
    return;
  }
  const strong = [];
  const weak = [];
  for (const [lineStr, entry] of Object.entries(forFile)) {
    const line = parseInt(lineStr, 10) - 1;
    if (line < 0 || line >= editor.document.lineCount) continue;
    const range = editor.document.lineAt(line).range;
    const hasWeak = (entry.claims || []).some((c) => c.class === 'inferred');
    (hasWeak ? weak : strong).push({ range });
  }
  editor.setDecorations(noteDecoration, strong);
  editor.setDecorations(weakDecoration, weak);
}

function paintAll() {
  vscode.window.visibleTextEditors.forEach(paint);
}

function activate(context) {
  noteDecoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor('editor.wordHighlightBackground'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.infoForeground'),
    overviewRulerLane: vscode.OverviewRulerLane.Right,
  });
  weakDecoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor('inputValidation.warningBackground'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.warningForeground'),
    overviewRulerLane: vscode.OverviewRulerLane.Right,
  });

  load();
  paintAll();

  const hover = vscode.languages.registerHoverProvider(
    { scheme: 'file' },
    {
      provideHover(document, position) {
        const forFile = notesFor(document);
        if (!forFile) return null;
        const entry = forFile[String(position.line + 1)];
        return entry ? buildHover(entry) : null;
      },
    }
  );

  // Follow the notes file so the walk can advance and the editor keeps up.
  const root = workspaceRoot();
  let watcher;
  if (root) {
    watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(root, '.docent/notes.json')
    );
    const refresh = () => { load(); paintAll(); };
    watcher.onDidChange(refresh);
    watcher.onDidCreate(refresh);
    watcher.onDidDelete(refresh);
  }

  context.subscriptions.push(
    hover,
    noteDecoration,
    weakDecoration,
    vscode.window.onDidChangeVisibleTextEditors(paintAll),
    vscode.commands.registerCommand('docent.reload', () => {
      load();
      paintAll();
      const n = Object.keys(notes).length;
      vscode.window.showInformationMessage(`Docent: notes reloaded for ${n} file(s)`);
    }),
    vscode.commands.registerCommand('docent.toggle', () => {
      enabled = !enabled;
      paintAll();
      vscode.window.setStatusBarMessage(
        enabled ? 'Docent: notes shown' : 'Docent: notes hidden',
        2000
      );
    })
  );
  if (watcher) context.subscriptions.push(watcher);
}

function deactivate() {}

module.exports = { activate, deactivate };
