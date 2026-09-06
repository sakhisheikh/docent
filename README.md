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
a decision and the lines that are lookup tables, byte packing and plumbing. In
the change that prompted this tool, 120 of 2,445 lines carried every decision.
Finding that 5% is most of the value.

**Walk.** It plays. The editor opens each file, scrolls to the lines being
discussed, dims everything else, and narrates beside them. You watch. It moves
on by itself and holds each step long enough to read it.

```
  [ your code, spotlit ]        │  4 of 6          playing · 1x · ~9 min
                                │
  s.receiver.Close()            │  teardownStream: the ordering that
  ...        close first,       │  deadlocks if reversed
             then wait          │
  <-s.drainDone                 │  The receiver is closed before the drain
                                │  is waited on. Reverse those two lines and
                                │  it hangs forever, because closing the
                                │  socket is the only thing that ends a
                                │  blocked read.
                                │
                                │  READ  closing the receiver unblocks the drain
                                │        the comment and ordering at :461
```

Space to pause, arrows to step, up and down for speed. Pause and ask anything;
the walk is there in the terminal.

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

```
cd editor/vscode
cp -r . ~/.vscode/extensions/sakhisheikh.docent-0.2.0
```

Restart VS Code, then **Docent: open the tour**.

| | |
|---|---|
| cmd+alt+space | play or pause |
| cmd+alt+left / right | previous, next |
| cmd+alt+up / down | faster, slower |

The status bar shows where you are and what is left.

## Requirements

Claude Code, git, and a repo. GitHub remotes get permalinks; other remotes
degrade to `path:line`. Nothing is posted anywhere without asking.

## Licence

MIT
