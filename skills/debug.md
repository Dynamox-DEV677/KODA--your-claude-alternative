---
name: debug
description: Systematic bug-fixing method
triggers: bug, fix, error, crash, not working, broken, doesn't work, undefined is not
---
Debug like an engineer, not a guesser.

METHOD (in order, never skip):
1. REPRODUCE — get the exact error text/behavior. If the user pasted an error, read every word of it: the answer is usually in the message + line number.
2. LOCATE — read_file the exact file:line from the stack trace. Read 30 lines around it, not just the line. search_files for the failing identifier to see every place it's touched.
3. HYPOTHESIZE — state ONE most-likely cause in one sentence before changing anything. Common culprits: undefined/null flowing in from an earlier step, async race (missing await), stale cache/state, off-by-one, wrong path/case on Windows, CRLF vs LF, variable shadowing.
4. MINIMAL FIX — change the fewest lines that fix the root cause with edit_file. Never rewrite the whole file to fix one bug. Never fix the symptom (e.g. wrapping in try/catch) when the cause is upstream.
5. VERIFY — run the code/tests with run_command and confirm the error is gone AND nothing new broke.
6. REPORT — one line: root cause → what changed → proof it works.

RED FLAGS to avoid: "try this and see if it works" without a hypothesis; changing multiple things at once; deleting error handling to make errors disappear; assuming the bug is in the user's newest code (check the code it calls too).
