# State: schema and resume

`.docent/state.json` in the target repo. It exists so a walk survives
compaction, a lost session, and a week away. **After any resume, read it
before speaking. It is the truth; your memory of the walk is not.**

## Schema

```json
{
  "version": 1,
  "head": "68dfc9f...",
  "base": "7e82aa2...",
  "base_ref": "upstream/main",
  "remote": "https://github.com/owner/repo",
  "skipped": "4 test files (+727) read as evidence; keys.go, 157 lines, lookup table",
  "position": 2,
  "speed": 1,
  "mode": "pause",
  "emitted": false,
  "stops": [
    {
      "id": 1,
      "title": "Why a HID package owns a video stream",
      "file": "ios/hid/hid.go",
      "line": 1,
      "status": "walked",
      "claims": [
        {
          "text": "touch reports are accepted and discarded without a stream",
          "class": "executed",
          "evidence": "ran hid tap on iOS 18.7.3: CoreDeviceError 9021"
        }
      ]
    }
  ],
  "questions": [
    {
      "q": "What deadlocks if teardown waits before closing?",
      "asked": true,
      "answered": "correct",
      "revisit_stop": null
    }
  ]
}
```

A step's `anchor` is what keeps it pointing at the right code. On a resume,
prefer relocating by anchor over trusting `focus`, and reset a step to
`pending` only when its anchor cannot be found at all.

`speed` is a number (1 is normal, 2 skims, 0.5 goes deep) and `mode` is
`pause` or `play`; both survive a resume so the walk comes back as it was
left. `status` is `pending`, `walked`, `skipped`, or `revisit`. `class` is one of `tested`,
`executed`, `read`, `inferred`. `answered` is `correct`, `missed`, or
`skipped`.

## Write points

- After triage: the whole file.
- After each stop advances: `position`, that stop's `status`.
- After any challenge: the claim's `class` and `evidence`, everywhere that
  claim appears.
- After each quiz answer: the `questions` entry, and `status: "revisit"` on a
  miss.
- After emit: `emitted: true`.

## Resume rules

Run `/docent` with state present:

1. **HEAD matches `head`.** Offer: resume at `position`, restart, or emit from
   what is already walked. Default to resume.
2. **HEAD moved.** Diff the new HEAD against the walked one. Stops whose files
   are untouched keep their status and claims. Stops whose files changed
   return to `pending` and their claims drop to `inferred` until re-walked -
   evidence was for code that no longer exists. Say which stops were reset and
   why.
3. **Base moved** (rebase, or the base branch advanced): re-triage. Offer to
   carry forward claims whose text and file both still match.
4. **Corrupt or unreadable state.** Do not guess. Say it is unreadable, offer
   a fresh triage, and move the old file to `.docent/state.broken.json`.

Never silently discard a walked stop. If work is lost, name it.
