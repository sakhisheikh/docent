# Contributing

Help is wanted, and the honest gaps are listed at the bottom.

## The one law

**Never present a claim above its evidence.** Every claim docent emits carries
a class: `tested`, `executed`, `read`, or `inferred`. A confident wrong
walkthrough is worse than no walkthrough, because the author repeats it in a
review and gets caught by it.

If a change makes it easier to state something as fact than to state it as an
inference, that change is going the wrong way. This is the whole product, not
a nicety.

## Running it

The plugin, from a local checkout:

```
/plugin marketplace add /path/to/docent
/plugin install docent@docent
```

The player:

```
cd editor/vscode
cp -r . ~/.vscode/extensions/sakhimansoor.docent-0.9.0
```

Restart VS Code, then **Docent: open the tour** in any repo with a
`.docent/tour.json`.

## Tests

```
./tests/run.sh
```

Four shell tests and one node test, no dependencies beyond git, python3, bash
and node. They run on Linux and macOS in CI.

`tests/voice_test.js` drives the extension against a stubbed editor. The stub
answers only what `extension.js` actually calls, so a new call site shows up
as a missing stub rather than as a pass. Two classes of bug live here and
cannot be caught by reading:

- webview APIs that live on `panel.webview` and not on `panel`, which throw
  before any HTML is written
- steps that advance before the narration finishes

Both have happened. `tests/plugin_test.sh` greps for the first, `voice_test.js`
exercises the second.

## Layout

```
skills/docent/          the skill Claude Code loads
  SKILL.md              the protocol, hard limit 250 lines
  references/           evidence classes, artifact style, resume rules
  templates/            what gets emitted at the end of a walk
  scripts/              facts, show, progress, annotate
editor/vscode/          the player
.claude-plugin/         makes this repo both a plugin and a marketplace
tests/                  run.sh runs everything
```

`SKILL.md` is capped at 250 lines and each reference at 120, enforced by
`plugin_test.sh`. A skill nobody finishes reading does not get followed, so
new guidance usually means rewriting a line rather than adding one.

## Style

Anything docent emits, and the docs here, follow
[`skills/docent/references/artifact-style.md`](skills/docent/references/artifact-style.md).
The short version: plain English, short sentences, no em dashes. Never restate
what the reader can already see. Never describe what the code does not do. Say
why a fact matters, not just that it is true.

Write for an engineer who has never seen this codebase and did not ask to be
here.

## What would help most

These are the real gaps, roughly in order of how much they matter.

1. **A tour generated end to end by the plugin, on someone else's change.**
   The protocol has been proven on triage only. Every tour played so far was
   hand written. If you run `/docent` on a real PR and the tour it produces is
   bad, that transcript is the most useful thing you can file.
2. **Linux speech.** The player calls `spd-say` and nobody has run it.
3. **Windows speech.** There is none. `speechArgs` returns null and the player
   falls back to a timer.
4. **Line drift.** Steps carry an `anchor` snippet and the player searches
   outward from the recorded line to find where it moved. It gives up after
   200 lines and says so in the panel. A better strategy is welcome.
5. **Editors other than VS Code.** The tour format is plain JSON and carries no
   VS Code concepts, so another player is a self-contained project.

## Reporting

An issue that says what you ran, what you expected, and what happened is
enough. If a tour claimed something that was not true, that is the most
valuable report there is, and please include the claim's class.
