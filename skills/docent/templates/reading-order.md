<!--
Fill from state.json. One section per stop, in walk order.
Rules: no preamble, no meta-narration, no line-count apology. Permalinks
pinned to the walked SHA. Delete this comment.
-->
### Where to look

**1. {stop title, as a plain statement}**
[{file}#L{line}]({remote}/blob/{head}/{file}#L{line})

{Two or three sentences. What was decided and why it could have been
otherwise. Not what the identifier already says.}

**2. {stop title}**
[{file}#L{line}]({remote}/blob/{head}/{file}#L{line})

{Two or three sentences. If this stop has a claim worth challenging, end with
the question a reviewer should ask.}

<!-- repeat per stop, 5 to 9 total -->

### Two things that are easy to get wrong

{The contracts a caller would break. One line each, no elaboration. Delete the
section if the change has none.}

### The rest

{Everything skipped, named with counts. "keys.go is a lookup table, 157 lines.
report.go packs bytes to the layouts in its comments."}
