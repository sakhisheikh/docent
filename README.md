# docent

An AI writes 2,000 lines. Your name goes on the pull request. You have not read
a line of it, and the reviewer is about to ask you questions.

Docent walks you through it.

## Install

```
/plugin marketplace add sakhisheikh/docent
/plugin install docent@docent
```

Then, on a branch you are about to send for review:

```
/docent
```

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

This is the player, and most of the point.

Install the `.vsix` from the
[latest release](https://github.com/sakhisheikh/docent/releases/latest):

```
code --install-extension docent-0.9.0.vsix
```

Or from a checkout, which is what you want if you are changing it:

```
cd editor/vscode
cp -r . ~/.vscode/extensions/sakhimansoor.docent-0.9.0
```

Either way restart VS Code, then **Docent: open the tour**. It is not on the
VS Code Marketplace yet.

Everything is in the panel: play, pause, step, speed, and a bar you can seek.
The status bar item toggles play too, and the keys are there if you want them.

Each stop is read out loud, so the code can be read while listening, and the
step ends when the sentence does rather than on a guess at reading speed. The
speaker button in the panel silences it. macOS uses `say` and Linux `spd-say`;
`docent.voice` picks a voice, and `docent.speak` turns it off by default.

| | |
|---|---|
| ctrl+alt+space | play or pause |
| ctrl+alt+[ ctrl+alt+] | previous, next |
| ctrl+alt+- ctrl+alt+= | slower, faster |
| ctrl+alt+v | voice on or off |

macOS claims cmd+alt+space for Finder search, which is why these use ctrl.

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

Claude Code, git, and a repo. GitHub remotes get permalinks; other remotes
degrade to `path:line`. Nothing is posted anywhere without asking.

## Licence

MIT
