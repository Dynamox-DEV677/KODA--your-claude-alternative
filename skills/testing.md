---
name: testing
description: Writing tests that catch real bugs
triggers: test, tests, unit test, testing, jest, pytest, vitest, tdd
---
Write tests with the runtime's built-in runner first: node:test + node:assert for JS (zero deps, `node --test`), unittest or pytest for Python.

WHAT TO TEST (in priority order):
1. The bug you just fixed — a regression test that fails without the fix.
2. Boundaries: empty input, one item, exactly-at-limit, one-over-limit, zero, negative, huge, unicode.
3. Error paths: invalid input returns the right error and does NOT corrupt state.
4. The core business rule the app exists for.
Skip: getters, framework code, things the type system already guarantees.

STRUCTURE: arrange-act-assert, one behavior per test, name = the sentence it proves ("rejects bookings more than 30 days out"). No shared mutable state between tests — each builds its own fixture.

RULES:
- Test through the public interface, not private internals — refactors shouldn't break tests.
- Fake time (inject a clock / use fake timers), never sleep in tests.
- Mock ONLY at boundaries (network, disk, clock). If you mock everything, you test nothing.
- A test you watched fail is worth ten you never did — when writing a regression test, run it against the broken code first if possible.
- Deterministic: no real network, no Math.random without seeding, no order dependence.

VERIFY: actually run the suite with run_command and show the pass count. A test file that was never run is a rumor.
