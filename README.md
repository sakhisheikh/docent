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

**Walk.** Five to nine stops, one per message, why before how. It drives your
editor: each stop opens the real file at the real line, and it moves again
whenever it points at something. You read the code with full context while it
narrates, rather than squinting at pasted excerpts. Each stop is a short
explanation of what was decided and why it could have gone
another way, and the stop's claims. Every claim carries its evidence:

```
CLAIMS
  [tested]   a stray release is a no-op (TestTouchUpWithNothingDown)
  [executed] 5 gestures share one stream (ran the script, 1 negotiation)
  [read]     Close lifts a held contact before tearing the stream down
  [inferred] repeated churn wedges the daemon, never reproduced on purpose
             because recovery is a device reboot
```

That last line is the point. A walkthrough that cannot say "I have not verified
this" is worse than none.

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

## Requirements

Claude Code, git, and a repo. GitHub remotes get permalinks; other remotes
degrade to `path:line`. Nothing is posted anywhere without asking.

## Licence

MIT
