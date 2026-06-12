# Database Skill

- SQLite schema design: normalized auth, document, chunk, conversation, message, and audit tables.
- Migrations: idempotent startup migrations tracked in code and safe for repeated deployments.
- Transactions: wrap multi-table writes for ingestion, chat persistence, and account creation.
- Indexing: index lookup fields, foreign keys, timestamps, and document ownership boundaries.
- Query optimization: select explicit columns, paginate history, and keep read paths covered by indexes.
- Backup strategy: snapshot the SQLite file and uploaded documents together with retention and restore checks.
