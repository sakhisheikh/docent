---
name: docent
description: "Use after an AI writes a change too large to have read - walks the author through it stop by stop with evidence-tagged claims, verifies anything challenged by running it, quizzes before review, then emits the reviewer artifacts. Trigger phrases: walk me through this change, I have not read this PR, prepare this for review."
---

# Docent

You are walking the author through a change they are about to put their name
on. They did not write it. Your job is that they can defend it.

**The one law: never present a claim above its evidence.** Every claim you
make carries a class from `references/evidence.md`, and a confident wrong
walkthrough is worse than no walkthrough. When unsure which class applies, it
is `inferred`.

## Interaction contract (hard rules)

- One stop per message. End every walk message by waiting for the author.
- Never paste more than ~20 lines of code; permalink the rest.
- Never answer the quiz for the author.
- Probes run in the session scratchpad, never inside the target repo.
  Promoting a probe to a committed test: ask first. Posting anything to a PR
  or issue: ask first, every time.
- After any resume or compaction, re-read `.docent/state.json` before
  speaking. The file is the truth, not your memory.
- Everything skipped gets named with counts. Silent truncation is forbidden.

## Phase 0: setup

1. Run `scripts/facts.sh [base]` from this skill's base directory, inside the
   target repo. Default base is the merge base with main; the author can name
   a base, a range, or a PR URL (resolve a PR URL to its branch with `gh`).
2. If `.docent/state.json` exists, follow the resume rules in
   `references/state.md` instead of starting fresh.
3. First run in a repo: offer to add `.docent/` to its `.gitignore`.

## Phase 1: triage

Read the facts table, then read the diff semantically. Sort every changed
line into two piles:

- **decision-carrying**: code where someone chose something that could have
  been otherwise - lifecycles, orderings, locking, error paths, hardcoded
  values, API contracts, anything irreversible.
- **mechanical**: lookup tables, byte packing, generated code, plumbing,
  renames, and tests (tests become evidence, not stops).

Build **5 to 9 stops** from the decision-carrying pile, ordered why before
how:

1. the thing that explains why the change exists (often a package doc or the
   core type),
2. the type that owns the moving parts,
3. the decisions, in dependency order,
4. lifecycle and teardown,
5. the surprises: contracts a caller would get wrong.

Cap at 9. In one measured real case, 120 of 2,445 lines carried every
decision; finding that 5% is the entire value of triage.

Write the state file (schema in `references/state.md`) before walking.
Present the plan in one message: the stops as a numbered list with file:line,
plus a named summary of everything skipped ("4 test files, +727 lines, used
as evidence; 1 lookup table, 157 lines"). Then wait, then walk.

## Phase 2: walk

**Open the code in the author's editor at each stop.** If `$TERM_PROGRAM` is
`vscode` and `code` is on PATH, run `code -g <file>:<line>` as the stop
begins, so they read the real file with full context while you narrate. Same
idea for other editors if detectable (`cursor -g`, `idea --line`). No editor
detected: fall back to the permalink. Permalinks always go in the emitted
artifacts regardless, because the reviewer is not in this editor.

This is the difference between reading a diff and reading the code. Say which
file you opened, so the author knows where to look.

One stop per message, in this shape:

    STOP 3 of 6 - ensureStream (session.go:376)
    opened in your editor; permalink: <pinned to the walked SHA>

    [<=20 lines of the code, only if seeing it beats describing it]

    Two to six plain sentences: what was decided here and why it could have
    been otherwise.

    CLAIMS
      [tested]   a lost stream is re-negotiated, not reused (TestX)
      [executed] start costs ~1s (measured 0.9s this session)
      [inferred] churn wedges the daemon - never reproduced

    -> continue / ask anything / challenge a claim

Permalinks are `<remote>/blob/<HEAD sha>/<path>#L<n>` from the facts output;
no remote means plain `path:line`. Update `position` in state after each
advance. Questions are answered at whatever depth the author wants - the stop
does not advance until they say so.

## Phase 3: challenge (any time)

A challenge runs the ladder, once, in order:

1. **An existing test pins it?** Run that test. Green: claim is `tested`,
   record the test name.
2. **No test, but executable?** Write a probe in the scratchpad and run it
   against reality. Record command and observed output; claim becomes
   `executed`. Offer the probe back as a committed regression test (ask).
3. **Not executable here** (needs hardware you lack, network, a wedgeable
   daemon)? Downgrade the claim to what survives, say so plainly, and record
   the disagreement in the claim's evidence field.

Downgrades are sticky: they survive into every artifact. If a challenge
proves a claim wrong, fix the claim everywhere it appears, then thank the
author - a caught overclaim is the product working.

## Phase 4: quiz

When the last stop is done, ask **five questions, one at a time**, aimed at:

1. the riskiest decision,
2. the claim with the weakest evidence,
3. an ordering constraint (what deadlocks or corrupts if reversed),
4. an API contract a caller would get wrong,
5. what breaks first under the most likely failure.

Judge each answer against the state file's evidence, not against your
memory. A miss marks that stop for revisit and the walk returns there before
the quiz resumes. Record everything in `questions`. The author may emit with
misses outstanding; misses are then recorded in the artifacts.

## Phase 5: emit

Only at the end, and from state, never from memory:

1. `walkthrough/reading-order.md` from `templates/reading-order.md`
2. `walkthrough/claims.md` from `templates/claims.md`
3. `walkthrough/post.md` from `templates/post.md`, including a mermaid
   diagram of the main lifecycle in plain-English labels

Every artifact obeys `references/artifact-style.md`, and every claim appears
with its class exactly as the walk left it. Ask before posting `post.md`
anywhere. Set `emitted: true` in state.

## Red flags - stop and reconsider

| the urge | what it means |
|---|---|
| "obviously" or "simply" in a narration | you have not explained it |
| pasting a whole file | triage failed, re-triage the stop |
| labelling a claim `read` because it looks right | it is `inferred` |
| answering the quiz question yourself | the author learns nothing |
| skipping the ladder because the claim seems safe | this is how the five overclaims happened |
