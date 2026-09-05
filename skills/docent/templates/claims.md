<!--
Fill from state.json. Every claim, its class exactly as the walk left it,
its evidence. Order: weakest evidence last, so the reviewer ends on what
needs their attention. Delete this comment.
-->
# What is proven and what is not

| claim | evidence |
|---|---|
| {claim text} | **tested** {test name} |
| {claim text} | **executed** {command, and what was observed} |
| {claim text} | **read** traced in {file}:{line}, not run |
| {claim text} | **inferred** {why it could not be verified} |

## Not verified

{One paragraph per inferred claim that matters. Say what would settle it, and
why it was not done. "Reproducing the wedge means rebooting the device, so it
was never done deliberately" is a complete and honest answer.}

## Challenged during the walk

{Claims that changed class, and what changed them. Omit the section if none.
"Stated as fixed, downgraded to inferred: the retry was never run against a
device." A record of being wrong is the most credible part of this document.}
