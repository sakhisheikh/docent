# The evidence law

Every claim carries a class. The class is not a formality: it is the whole
reason a walkthrough is worth reading rather than skimming.

| class | means | how it gets there |
|---|---|---|
| `tested` | a test in the repo pins this | you ran that test and it passed |
| `executed` | observed against reality during this walk | you ran something and saw the output |
| `read` | traced through the source | you followed the code, did not run it |
| `inferred` | your reading of what it probably does | everything else |

Two rules decide the class:

- **Default down.** If you cannot name the test or the command, it is not
  `tested` or `executed`. If you did not trace it line by line, it is not
  `read`. When torn, pick the lower class.
- **Name the evidence.** `tested` carries a test name, `executed` carries the
  command and what was observed. A class without evidence attached is
  `inferred` wearing a costume.

## Upgrades and downgrades

Upgrades come from the ladder in SKILL.md phase 3, never from confidence.
Downgrades are sticky: once a claim drops, it stays dropped in the state file,
in the walk, and in every emitted artifact. Rewriting a claim to sound safer
while keeping its old class is the failure this whole file exists to prevent.

## Worked examples, all real

These are actual overclaims from the session that produced this tool. Each was
caught only because a human pushed back. Assume yours will not be.

**1. Stated as fact, was inference.**
Claimed: "an interrupted read leaves the stream mid-message, so the connection
is closed". The truth: an interrupted read *may* have consumed part of a
message, and nothing reports whether it did. The connection is closed because
the position is *unknown*, not known bad. The fix was not just wording - the
reason changed. `inferred`, and the narration must say why the safe action is
still right.

**2. A protocol name asserted from a log line.**
Claimed the unimplemented event kinds "use Apple's Mercury peer-event
envelope", citing a daemon log. Nobody had decoded that format. Correct claim:
"we could not work out their message format". `inferred`, and say so.

**3. A fix described as working, never run.**
A retry was written to stop a media stream over a fresh connection. It was
plausible, it compiled, its tests passed - and there was a specific mechanism
(a per-connection client id) by which it could have been a silent no-op. Only
running it against a device settled it, three times, watching the packet count
drop to zero. Before that run: `inferred`. After: `executed`, with the numbers.

**4. Reasoning that was backwards.**
A comment said disabling long-term reference frames "eliminates mid-stream
tearing", implying the flag fixes tearing. LTRP is what *causes* the tearing
under packet loss. Plausible sentences can be exactly inverted and still read
well. If you cannot say which direction the causation runs, it is `inferred`.

**5. Insurance against a break that could not happen.**
An API was made variadic "so a later change would not be breaking upstream".
Adding a variadic parameter is backward compatible in Go, so there was no
break to prevent. The claim was never tested; a ten-line experiment disproved
it. Architectural justifications are claims too, and they are the easiest ones
to state without evidence.

## What good looks like

    CLAIMS
      [tested]   a stray release is a no-op (TestReleaseWithNothingHeld)
      [executed] 5 gestures share one stream (ran the script, 1 negotiation)
      [read]     Close lifts a held contact before tearing the stream down
      [inferred] repeated churn wedges the daemon; never reproduced on purpose
                 because recovery is a device reboot

The last line is the most valuable one in the table. It tells the reviewer
exactly where to push.
