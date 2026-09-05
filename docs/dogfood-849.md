# Dogfood: go-ios PR 849

A dry run of the triage phase against the change docent was designed from,
with the hand-built artifacts as the answer key. Run 2026-09-05, before any
live walk.

## Input

    9 files, +1754
    source  5 files, +1027
    test    4 files, +727

## Triage the protocol should produce

Decision-carrying, by the SKILL.md definition (someone chose something that
could have been otherwise):

| stop | file:line | why it qualifies |
|---|---|---|
| 1 | hid.go:1 | why a HID package owns a video stream, the fact the rest depends on |
| 2 | session.go:60 | the type that owns a connection, a service, a receiver and a goroutine |
| 3 | session.go:376 ensureStream | one stream per session, and re-negotiation on loss |
| 4 | session.go:439 teardownStream | close before wait, an ordering that deadlocks if reversed |
| 5 | session.go:165 stroke | release where the contact is, not where the path ended |

Mechanical, to be named and skipped with counts:

- keys.go, 138 lines, an ASCII to HID lookup table
- report.go, 64 lines, byte packing to documented layouts
- payload.go, 109 lines, request dictionaries
- 4 test files, +727, read as evidence rather than walked

## Answer key

Those five stops are exactly the five in the reading order posted to the PR,
which was built by hand over an afternoon. Independent agreement on the stops
is the M3 acceptance criterion.

The quiz questions should land on what the humans actually asked during
review:

- why `stopAll` must be true when a client only ever holds one stream
- why `context.AfterFunc` closing the connection, rather than a select on
  `ctx.Done()`
- what deadlocks if teardown waits on the drain before closing the receiver
- why the release position in `stroke` matters, with the 900 versus 20 case
- why `SendReport` returning nil does not mean anything happened

## Claims the walk must not overstate

From the real session, with their correct classes:

| claim | correct class | what makes it that |
|---|---|---|
| a stray release is a no-op | tested | TestTouchUpWithNothingDownSendsNothing |
| five gestures share one stream | executed | ran the script, one negotiation observed |
| stopping over a new connection works | executed | three runs, packet count to zero |
| churn wedges the mediastream daemon | inferred | never reproduced on purpose, recovery is a reboot |
| the surfaces cannot be polled for readiness | executed | polled every 50ms for 500ms, no field appears |

The fourth line is the test of the protocol. It is the claim most likely to
be waved through as fact, and the artifacts must carry it as inferred.

## Not yet run

This is triage on paper. The live walk, the challenge ladder against a real
device, and the quiz are M3 and need the author present.
