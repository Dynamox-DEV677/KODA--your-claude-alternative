---
name: sql-databases
description: Schema design and SQL that scales past the demo
triggers: sql, sqlite, postgres, database, schema, migration, query, db
---
Default to SQLite for local apps (node:sqlite in Node 22+, better-sqlite3, or Python's sqlite3) — one file, zero setup. Postgres/Supabase when multi-user.

SCHEMA RULES:
- Every table: id INTEGER PRIMARY KEY (or uuid), created_at defaulting to now. Timestamps in UTC, ISO strings or epoch — pick one and never mix.
- Names: snake_case tables plural (users, bookings), columns singular. Foreign keys named user_id with an actual FOREIGN KEY constraint and an index.
- NOT NULL by default; nullable is a decision, not the default. CHECK constraints for enums/ranges — bad data blocked at the door is a bug that never happens.
- Store money as integer paise/cents. Never float.

QUERY RULES:
- Parameterized queries, always (?, $1) — string-built SQL is both an injection hole and a quoting bug farm.
- SELECT the columns you need, not * (schema changes silently break code reading by position).
- Index every column that appears in WHERE/JOIN/ORDER BY of a hot query — and verify with EXPLAIN when something is slow.
- N+1 is the classic silent killer: fetch children with one IN query or a JOIN, never a query-per-row loop.
- Wrap multi-statement changes in a transaction — half-applied writes are worse than failed ones.

MIGRATIONS: never edit an applied migration; add a new numbered one. Keep a schema_version table even in toy apps — future-you will thank present-you.
