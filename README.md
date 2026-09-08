# docent

A 2,000 line diff has maybe a hundred lines where someone made a decision. The
rest is lookup tables, byte packing and plumbing.

Docent finds those hundred, walks you through them in your editor, and marks
every claim as tested or merely assumed. The walkthrough commits to the branch,
so each reviewer plays the same one instead of starting the diff from the top.

```
 ◀  Pause  ▶   1x ▾   🔊                      14 of 22  ·  ~18 min left

 client.go   codec.go    util  config   store.go                tests
 ▓▓ ▓▓ ▓▓ ▓▓  ▓▓ ▓▓ ▓▓    ▓▓   ▓▓ ▓▓    ▓▓ ▓▓ ▓▓ ██ ░░ ░░ ░░ ░░  ░░ ░░ ░░ ░░

 closeAndWait: the ordering that deadlocks if reversed
 store.go:214

 The reader is closed before the worker is waited on. Reverse
 those two lines and it hangs forever, because closing the socket
 is the only thing that ends a blocked read.

 READ   closing the reader unblocks the worker
        the comment and the ordering at store.go:231
```

The bar maps the change: one segment per step, grouped by file, each file as
wide as the steps it earned. Mechanical steps are dimmer. Amber means the step
rests on claims nobody verified, which is where a reviewer should push.

## Setup

| | does | who needs it |
|---|---|---|
| Claude Code plugin | generates the tour | whoever sends a change for review |
| VS Code extension | plays the tour | everyone, reviewers included |

Reviewing someone else's change needs only the extension.

**1. The plugin.** In Claude Code:

```
/plugin marketplace add sakhisheikh/docent
/plugin install docent@docent
```

**2. The extension.** Search **docent** in Extensions (**⇧⌘X**, or
Ctrl+Shift+X), publisher `sakhimansoor`. Or `code --install-extension
sakhimansoor.docent`. On macOS `code` is often not on the PATH: run
**Shell Command: Install 'code' command in PATH** from **⇧⌘P**.

**3. Generate.** On the branch you are about to send for review: `/docent`.
It reads the diff, shows you the plan, and waits. Nothing is committed or
posted without asking.

**4. Play.** **⇧⌘P** then **Docent: open the tour**, or the `docent` status
bar item. A branch that already carries a tour offers to play it when you open
the folder.

### Keys

Everything is a button in the panel, so these are optional. macOS reserves
**⌘⌥Space** for Finder, so docent uses Control and Option. **⌥** is Option,
sometimes printed Alt.

| macOS | Windows and Linux | |
|---|---|---|
| **⌃⌥Space** | Ctrl+Alt+Space | play or pause |
| **⌃⌥[** **⌃⌥]** | Ctrl+Alt+[ ] | previous, next |
| **⌃⌥-** **⌃⌥=** | Ctrl+Alt+- = | slower, faster |
| **⌃⌥V** | Ctrl+Alt+V | voice on or off |

### For a team

Commit this as `.claude/settings.json` and step 1 happens by itself:

```json
{
  "extraKnownMarketplaces": {
    "docent": { "source": { "source": "github", "repo": "sakhisheikh/docent" } }
  },
  "enabledPlugins": { "docent@docent": true }
}
```

The extension updates itself. The plugin is pinned at install, so a new version
needs `/plugin marketplace update docent`.

### If something breaks

| | |
|---|---|
| `/docent` not offered | plugin not installed. Check `/plugin`, Installed tab |
| "no .docent/tour.json" | nothing has generated a tour on this branch |
| Panel opens, code does not move | the tour points at files not in this checkout. Wrong branch? |
| "anchor not found" | the code moved further than the player could follow. Narration still right, highlight may not be |
| Nothing read aloud | Windows has no voice and uses a timer. On Linux install `speech-dispatcher` |
| Keys dead | another extension has them. Rebind in Keyboard Shortcuts, search `docent` |

## What it does

**Triage.** Sorts the diff into lines where someone made a decision and lines
that are lookup tables, byte packing and plumbing. Every file gets a step, but
depth follows decision density. A real 1,754 line change came to 22 steps.

**Walk.** Plays in your editor, narrating each stop out loud. The step ends
when the sentence does, not on a guess at how fast you read.

**Challenge.** Push on a claim and it runs the ladder: run the test that pins
it, or write a probe and run it, or downgrade the claim honestly and keep it
downgraded everywhere. Probes that prove something are offered back as tests.

**Quiz.** Before you ship, the five questions your reviewer is most likely to
ask. Reading is not the bar. Defending is.

**Emit.** A claims table, a reading order with permalinks pinned to a SHA, and
a PR comment with a lifecycle diagram. It asks before posting anything.

## The tour travels with the branch

`.docent/tour.json` is committed, so anyone who checks out the branch plays the
same walkthrough at their own speed. A reading order in a PR comment is a list
of links someone skims. A tour is the review, handed over.

Only `state.json` is gitignored, being your own progress.

## Requirements

Claude Code, git, a repo, and VS Code 1.80+ for the player. GitHub remotes get
permalinks; others degrade to `path:line`. Speech uses `say` on macOS and
`spd-say` on Linux; Windows falls back to timed steps.

MIT.
