# Implementation plan

Each milestone leaves the repo in a shippable state. Done means the acceptance
line passes, not that code exists.

## M1. Scaffold and facts (tonight)

- Repo, MIT licence, plugin metadata, this plan, the spec.
- `facts.sh`: repo root, HEAD, merge base, https remote, per-file table with
  kind heuristics. Plain text output.
- `tests/facts_test.sh` builds a throwaway repo and asserts the output.

Accept: test passes, and facts.sh run against a real repo (go-ios, branch
feat/coredevice-hid-input) produces a correct table in under a second.

## M2. The protocol (tonight)

- `skills/docent/SKILL.md`: triage, walk, challenge ladder, quiz, emit, with
  the interaction contract (one stop per message, wait, twenty-line excerpt
  cap, re-read state after resume).
- `references/evidence.md`: the four classes, upgrade and downgrade rules,
  and the three real failure cases as worked examples.
- `references/artifact-style.md`: the writing rules for emitted artifacts.
- `references/state.md`: schema and resume rules.
- Templates: reading-order, claims, post.

Accept: a cold read of SKILL.md by someone who was not in the room is enough
to run a walk by hand. No reference exceeds ~120 lines; SKILL.md stays under
~250.

## M3. Dogfood on a real PR (first session after publish decision)

- Run /docent on go-ios feat/coredevice-hid-input (PR 849, 1,775 lines).
- Compare stops, claims and quiz against the hand-built artifacts and the
  questions the humans actually asked (stopAll, AfterFunc, varint, the stroke
  release bug, drain ordering).
- Every miss is a protocol bug: fix SKILL.md or references, re-run.

Accept: docent's triage independently selects ensureStream, teardownStream
and stroke as stops, and the claims table never presents an untested claim as
tested.

## M4. Eval fixture

- A seeded fixture repo: a small change with known decision lines, one
  planted subtle bug (release-at-wrong-point flavour), one plausible false
  claim.
- A scripted eval session with pass criteria from the spec, runnable before
  any protocol change.

Accept: the eval fails when SKILL.md's evidence rules are deliberately
weakened, passes otherwise.

## M5. Publish

- Push to github.com/sakhisheikh/docent (needs the author present).
- Verify `/plugin marketplace add sakhisheikh/docent` then
  `/plugin install docent@docent` on a clean machine profile.
- README demo: a real excerpt from the M3 dogfood, not a mocked one.

Accept: a stranger installs it from the README alone and completes a walk on
their own repo.

## Later, each with its trigger

- --thorough mode (adversarial pre-verification): when a walk on a real PR
  lets a wrong claim through the quiz.
- GitHub App / bot: when two people who are not the author ask for it.
- GitLab remotes: when a daily user works on GitLab.
- Interactive viewer: when the emitted artifacts are demonstrably not enough
  for reviewers.
