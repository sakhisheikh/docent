# Docent, a guided walkthrough for AI-written changes

Date: 2026-09-05
Status: approved in conversation (shape and flow), sections 2 to 4 written under
delegated authority while the author was away, pending their read-through.

## The problem

An AI writes a 3,000 line change. The human who asked for it has not read a
line, but their name goes on the PR and they must answer the reviewer's
questions. Reading a diff top to bottom does not work at that size, and most of
the lines are mechanical anyway. In one measured case, 120 of 2,445 lines
carried every decision; the rest were lookup tables, byte packing and CLI
plumbing.

This tool was designed immediately after living that case. Two go-ios PRs
(845, 849) were made reviewable by hand-building: a reading order with
permalinks pinned to a SHA, a lifecycle diagram posted before any code, decoded
examples next to byte layouts, and a claims discipline that separated what was
proven from what was assumed. That manual work is the product.

Two findings from that week drive the design:

1. The author is the first reviewer now. Author comprehension and reviewer
   comprehension are the same product.
2. Narration is cheap and trust is the hard part. The walkthrough overclaimed
   roughly five times (a "mid-message" claim that was inference, a protocol
   name stated as fact, a recovery path described as fixed that had never been
   run). Every one was caught only because the human challenged it. A
   walkthrough that cannot say "I have not verified this" is worse than none.

## Decisions taken with the user

- First user: the author, right after the AI writes the change. The artifact
  produced doubles as the reviewer's guide.
- Form: a Claude Code plugin. One command, runs in the session where the code
  was written, gets the runtime, repo, git and test execution for free.
- Ownership: personal and public. Generic git and GitHub, no employer-specific
  integrations. Lives under ~/Developer/personal with the personal git
  identity.
- Core mechanism: a stateful guided walk (approach B), not a one-shot document
  generator and not an adversarial verification pass. The document set is
  emitted at the end of the walk; the adversarial pass can become a
  --thorough mode later.

## Section 1. Shape and flow (approved live)

One command, `/docent`, five phases:

    triage -> walk -> challenge (any time) -> quiz -> emit

**Triage.** Diff the branch against its merge base (overridable with a range
or PR URL). Gather cheap facts with a script, then sort the change
semantically into decision-carrying lines and mechanical lines. Produce 5 to 9
ordered stops, why before how. Everything skipped is named with counts, never
silently dropped.

**Walk.** One stop per message: permalinked code pinned to the SHA, a short
narration, and the stop's claims, each tagged with an evidence class. Then
wait. The author continues, asks, or challenges.

**Evidence classes**, the data model of the whole product:

| class | meaning |
|---|---|
| tested | a test in the repo pins this behaviour |
| executed | ran against reality during the walk and observed |
| read | traced through source, not run |
| inferred | the model's reading, could be wrong |

**Challenge.** A challenge triggers the verification ladder: an existing test
is run; failing that a probe is written and run where feasible; failing that
the claim is downgraded honestly and stays downgraded in every artifact.
Upgrades stick, and a probe that proved a claim is offered back to the repo as
a regression test.

**Quiz.** The exit gate. "I read it" is not the bar, "I can defend it" is. The
docent asks the five questions a reviewer is most likely to ask. A miss loops
back to the relevant stop.

**Emit.** Only at the end: a `walkthrough/` directory in the target repo with
a reading order, the claims table with evidence classes, a mermaid diagram,
and a ready-to-paste PR comment. Posting anything anywhere is confirmed first.

**State** lives in `.docent/state.json` in the target repo, so the walk
survives compaction and resumes across sessions.

## Section 2. Components

The plugin is mostly prose. The protocol is the product; code is kept to one
script.

    docent/
      .claude-plugin/
        plugin.json          plugin metadata
        marketplace.json     lets /plugin marketplace add sakhisheikh/docent work
      skills/docent/
        SKILL.md             the protocol: triage, walk, challenge, quiz, emit
        references/
          evidence.md        the evidence law, with the real failure cases
          artifact-style.md  writing rules for everything docent emits
          state.md           state file schema and resume rules
        templates/
          reading-order.md   the reviewer-facing guide
          claims.md          the claims table
          post.md            the PR comment
        scripts/
          facts.sh           deterministic fact gathering, no LLM judgement
      docs/
        superpowers/specs/   this document
        plan.md              implementation plan and milestones
      tests/
        facts_test.sh        builds a throwaway repo, asserts facts.sh output
      README.md
      LICENSE                MIT

**SKILL.md** carries the interaction contract: one stop per message, always
stop and wait, never paste more than about twenty lines of code per stop
(permalink the rest), re-read state at the start of every turn after a resume.
It stays lean by pushing detail into references, which the agent reads when it
reaches that phase.

**facts.sh** answers only questions with deterministic answers: repo root,
HEAD SHA, merge base against the chosen base branch, the remote normalised to
an https URL for permalinks, and a per-file table of additions, deletions and
kind (source, test, doc, generated or vendor, by path heuristics). Output is
aligned plain text, not JSON: the consumer is a model, and text avoids an
escaping bug class entirely. All semantic judgement (which lines carry
decisions) belongs to the skill, not the script.

**Templates** encode the house style learned the hard way: plain English, no
em dashes, no restating what the reader can see, permalinks pinned to the SHA,
claims one line each with their class, and nothing that describes what the
code does not do.

## Section 3. State, resume and failure handling

**State file** `.docent/state.json`, written by the agent:

    {
      "head": "<sha triaged against>",
      "base": "<merge base sha>",
      "stops": [ { "id", "title", "file", "line", "status",
                   "claims": [ { "text", "class", "evidence" } ] } ],
      "position": <stop index>,
      "questions": [ ... quiz record ... ],
      "emitted": false
    }

Rules:

- `/docent` with existing state and matching HEAD offers resume or restart.
- HEAD moved since triage: offer re-triage. Stops whose files did not change
  survive; the rest are rebuilt.
- Compaction: the state file is the source of truth, the skill instructs the
  agent to re-read it rather than trust memory.
- `.docent/` is offered for the target repo's gitignore on first run.

**Failure handling:**

- Huge diffs: stops are capped at 9. The remainder appears as one named
  paragraph with counts ("14 files of generated protobuf, 2,100 lines,
  skipped"). Silent truncation is forbidden.
- Nothing runnable (no test framework, no device, no network): the walk still
  works; claims simply stay at read or inferred, and the emitted claims table
  says so. Honesty degrades gracefully, confidence does not.
- Probes: written to the session scratchpad, never into the target repo.
  Promoting a probe to a committed regression test asks first.
- Posting the PR comment asks first, every time.
- Non-GitHub remotes: permalinks degrade to path:line references.
- The verification ladder never loops more than once per claim per challenge;
  an unresolvable challenge records the disagreement in the claims table
  rather than stalling the walk.

## Section 4. Testing the product

Three layers, matched to what each part is:

1. **Script tests.** `tests/facts_test.sh` builds a throwaway git repo with
   known shape (source, test, vendor and doc files, a branch off a base),
   runs facts.sh, and asserts the table. Runs in CI eventually, runs by hand
   now.
2. **Protocol evals, not unit tests.** The skill is prose; its test is a
   seeded fixture repo containing a change with known decision lines, one
   planted subtle bug, and one claim that sounds true but is not. A scripted
   session passes when triage picks the decision lines as stops, the planted
   overclaim is not labelled tested, and the challenge ladder catches the
   bug. This is milestone 4, not v1: writing a good fixture is real work and
   dogfooding comes first.
3. **Dogfood.** The first real run is go-ios PR 849 (1,775 lines, public),
   where the hand-built artifacts already exist as the answer key. Docent's
   output is compared against what two humans and a maintainer actually
   needed. Differences are protocol bugs.

## Out of scope for v1

GitHub App or bot, web UI, GitLab, VS Code surface, multi-agent thorough
mode, telemetry, multi-repo changes, non-git inputs. Each is listed in
plan.md as a possible later milestone with its trigger condition.

## Open questions for the author's read-through

1. Name. "docent" is the working name and the repo name; veto before publish.
2. Quiz strictness: block emit until all five are answered, or allow emit
   with misses recorded in the artifacts? Current design: allow, record.
3. Should the claims table go into the PR comment by default, or only the
   reading order? Current design: reading order plus claims, one comment.
