# docent

An AI writes 2,000 lines. Your name goes on the pull request. You have not read
a line of it, and the reviewer is about to ask you questions.

Docent walks you through it.

## Setup

Two pieces, and which you need depends on what you are doing.

| | what it does | who needs it |
|---|---|---|
| **Claude Code plugin** | generates the tour | whoever is sending a change for review |
| **VS Code extension** | plays the tour | everyone, reviewers included |

If you only ever review other people's changes, the extension alone is enough.

### 1. Install the plugin

In Claude Code, type these two lines:

```
/plugin marketplace add sakhisheikh/docent
/plugin install docent@docent
```

To check it worked, type `/plugin` and look at the **Installed** tab. You
should see `docent`. The first command registers this repo as a marketplace;
the second installs the plugin from it.

### 2. Install the extension

Open the Extensions pane, **⇧⌘X** on macOS or **Ctrl+Shift+X** elsewhere,
search **docent** and pick the one published by **sakhimansoor**. Or from a
terminal:

```
code --install-extension sakhimansoor.docent
```

On macOS `code` often is not on your PATH. If you get "command not found",
open VS Code, press **⇧⌘P**, and run **Shell Command: Install 'code' command
in PATH**. Or just use the Extensions pane.

### 3. Generate a tour

Check out the branch you are about to send for review, then in Claude Code:

```
/docent
```

It reads the diff, tells you the plan, and waits. Nothing is committed or
posted without asking.

### 4. Play it

Press **⇧⌘P** on macOS or **Ctrl+Shift+P** elsewhere and run **Docent: open
the tour**. There is also a `docent` item in the status bar at the bottom left
which plays and pauses.

If a branch already carries a tour, the extension says so when you open the
folder and offers to play it.

### Keys

macOS reserves **⌘⌥Space** for Finder search, so docent uses Control and
Option instead. On a Mac keyboard **⌥** is the Option key, sometimes printed
as Alt.

| macOS | Windows and Linux | |
|---|---|---|
| **⌃⌥Space** | Ctrl+Alt+Space | play or pause |
| **⌃⌥[** and **⌃⌥]** | Ctrl+Alt+[ and ] | previous, next |
| **⌃⌥-** and **⌃⌥=** | Ctrl+Alt+- and = | slower, faster |
| **⌃⌥V** | Ctrl+Alt+V | voice on or off |

Everything is also in the panel as buttons, so you never have to learn these.

### Setting it up for a team

Commit this as `.claude/settings.json` in whatever repo the team works in.
Then nobody has to type or spell anything, and step 1 happens by itself:

```json
{
  "extraKnownMarketplaces": {
    "docent": { "source": { "source": "github", "repo": "sakhisheikh/docent" } }
  },
  "enabledPlugins": { "docent@docent": true }
}
```

They still install the extension themselves, since VS Code extensions cannot
be installed from a repo.

### Updating

The extension updates itself from the marketplace. The plugin does not: it is
pinned to a commit when installed, so pick up a new version with

```
/plugin marketplace update docent
```

### If something does not work

| what you see | what it is |
|---|---|
| `/docent` is not offered | the plugin is not installed. Run `/plugin` and check the Installed tab |
| "no .docent/tour.json in this workspace" | nothing has generated a tour on this branch yet. Run `/docent` |
| The panel opens but the code does not move | the tour points at files that are not in this checkout. Check you are on the right branch |
| "anchor not found, the highlight may be stale" | the code moved more than the player could follow. The narration is still right, the highlight may not be |
| Nothing is read out loud | on Windows there is no voice yet and steps are timed instead. On Linux install `speech-dispatcher` for `spd-say` |
| Keys do nothing | another extension has them. Rebind under **Keyboard Shortcuts**, search `docent` |

## What it does

**Triage.** It diffs the branch and sorts it into the lines where someone made
a decision and the lines that are lookup tables, byte packing and plumbing.
Every file gets at least one step, but depth follows decision density: a lookup
table earns twenty seconds saying why there is nothing to decide in it, a
lifecycle earns several steps. A real 1,754 line change came to 22 steps across
9 files.

**Walk.** It plays. The editor opens each file, scrolls to the lines being
discussed, dims everything else, and narrates beside them with a transport you
can drive.

```
 ◀  Pause  ▶   1x ▾                          14 of 22  ·  ~18 min left

 hid.go      report.go   keys  payload  session.go              tests
 ▓▓ ▓▓ ▓▓ ▓▓  ▓▓ ▓▓ ▓▓    ▓▓   ▓▓ ▓▓    ▓▓ ▓▓ ▓▓ ██ ░░ ░░ ░░ ░░  ░░ ░░ ░░ ░░
                    ▔▔                     ▔▔

 teardownStream: the ordering that deadlocks if reversed
 ios/hid/session.go:439

 The receiver is closed before the drain is waited on. Reverse
 those two lines and it hangs forever, because closing the socket
 is the only thing that ends a blocked read.

 READ   closing the receiver unblocks the drain
        the comment and the ordering at session.go:461
```

The bar is a map of the change: one segment per step, grouped under the file it
belongs to, each file as wide as the number of steps it earned. The current
file's name lights up. Click any segment to jump there.

Mechanical steps are dimmer, so you can see at a glance that `keys.go` is a
formality and `session.go` is where the thinking is. A segment underlined in
amber rests on `inferred` claims, which is where a reviewer should push.

**Challenge.** Push on any claim and it runs the ladder: run the test that
pins it; failing that write a probe and run it; failing that downgrade the
claim honestly and keep it downgraded everywhere. Probes that prove something
are offered back as regression tests.

**Transport.** The walk is playable. `pause` is the default and nothing moves
without you. `play` runs it through. `speed 2x` gives headlines, `speed 0.5x`
goes deep, and either way the evidence is the same: skimming is allowed,
hiding is not. Every stop carries the bar:

```
[####------] 3/6 - about 32 min left        speed 1x
```

That number is what a careful pass will actually cost you, from the volume of
decision-carrying code and how many claims need arguing with.

**Quiz.** Before it lets you ship, it asks the five questions your reviewer is
most likely to ask. Reading is not the bar. Defending is.

**Emit.** A reading order with permalinks, the claims table with evidence, and
a PR comment with a lifecycle diagram. It asks before posting anything.

## The tour travels with the branch

`.docent/tour.json` is committed. Anyone who checks out the branch and has the
extension gets a notification that the change ships a tour, and can play the
same walkthrough you had, at their own speed, stopping wherever they like.

That is the point. A reading order in a pull request comment is a list of
links someone skims. A tour is the review, handed over.

Only `state.json` is gitignored, because that is your own progress through it.

## Why the evidence classes exist

This tool was built the day after a session where an AI wrote 3,300 lines
across two pull requests and the author had not read any of it. Making it
reviewable by hand produced the reading orders, the diagrams and the decoded
byte examples that docent now generates.

It also produced five confident, wrong claims. A protocol name asserted from a
log line. A fix described as working that had never been run, and which had a
specific mechanism by which it could have silently done nothing. A causal
explanation that was exactly backwards. Every one was caught only because a
human pushed back on it.

Docent assumes nobody will push back. So it grades its own claims, defaults
downward, and makes "I could not verify this" a first-class output rather than
an admission.

## The editor extension

This is the player, and most of the point. Installing it is step 2 above; if
you are changing the extension itself, run it from a checkout instead:

```
cd editor/vscode
cp -r . ~/.vscode/extensions/sakhimansoor.docent-0.9.0
```

Everything is in the panel: play, pause, step, speed, and a bar you can seek.
The status bar item toggles play too, and the keys are there if you want them.

Each stop is read out loud, so the code can be read while listening, and the
step ends when the sentence does rather than on a guess at reading speed. The
speaker button in the panel silences it. macOS uses `say` and Linux `spd-say`;
`docent.voice` picks a voice, and `docent.speak` turns it off by default.

## What is proven and what is not

The product's own rule applies to its README.

- **The player works.** Tours play, seek, spotlight, follow drifting line
  numbers, read out loud, and save edits back to `tour.json`. Pinned by
  `tests/voice_test.js` and used daily.
- **Triage works.** Given a 1,754 line change across 9 files, the protocol
  independently picked the same five stops two people had picked by hand over
  an afternoon, three of them at the exact line, in 59 seconds.
- **A tour generated end to end has not been proven.** Every tour played so
  far was written by hand. This is the open question, and
  [CONTRIBUTING.md](CONTRIBUTING.md) says what would help.

## Requirements

Claude Code, git, and a repo, plus VS Code 1.80 or newer for the player.
GitHub remotes get permalinks; other remotes degrade to `path:line`. Nothing is
posted anywhere without asking.

Speech uses the operating system's own voice: `say` on macOS, `spd-say` on
Linux. Windows has none yet, so steps are held on a timer instead.

## Licence

MIT
