# Style for everything docent emits

The artifacts are read by a reviewer who has not seen the code and did not ask
to be here. Earn the attention.

## Rules

1. **Plain English.** Short sentences. No em dashes, no semicolon chains.
   Write for an engineer who has never seen this codebase. If a sentence needs
   a term the reader would have to look up, either explain the term on first
   use or find a plainer word: "counts upwards from when the program started"
   beats "anchored to a monotonic origin", and "the phone" beats "the device"
   when the device is a phone. Domain words like "surface" are fine once said
   plainly the first time.
2. **Never restate what the reader can see.** If the heading says
   `teardownStream`, the line under it does not say "teardownStream tears down
   the stream".
3. **Never describe what the code does not do.** "Deliberately not behind the
   mutex" belongs in a review reply, not an artifact.
4. **No meta-narration.** Cut "Half of this is byte layouts", "This document
   will walk you through", "As you can see". Start at the first real thing.
   This includes telling the reader how long to spend: "twenty seconds, not
   three minutes" is about the tour, not the code, and the step's kind already
   says it.
5. **Every claim carries its class**, exactly as the walk left it.
6. **Permalinks pinned to the walked SHA.** Links that rot are worse than
   path:line, which at least fails honestly.
7. **Name what you skipped, with counts.** "4 test files, +727 lines, read as
   evidence" beats silence.
8. **No line counts as an excuse.** State size once as a fact if useful, never
   as an apology or a boast.

## The shape that worked

A reviewer facing 1,775 lines used, in this order: a lifecycle diagram, a five
stop reading order with permalinks, and two "easy to get wrong" contracts.
Nothing else was read before the code.

Diagrams: label them in the reader's language, not the code's. "touch from us
now counts as the real touchscreen" beats "surfaces flip externalAccessory to
builtIn". If a label needs the codebase to parse, rewrite it.

## Worth including, always

- The decision that could most reasonably have gone the other way.
- The ordering that deadlocks or corrupts if reversed.
- The contract a caller will get wrong (a nil error that means "written", not
  "worked"; a parameter that takes a full set rather than a delta).
- The claims with the weakest evidence, so the reviewer knows where to push.

## Worth cutting, always

- Restated identifiers.
- Process detail ("split out of another PR so this one stays small").
- Anything that reads as a pitch.
- Praise of the change, in any form.
