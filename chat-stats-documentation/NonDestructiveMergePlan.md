# Non-Destructive Merge Plan (Final)

## Objective
- Make merges non-destructive and fully reversible.
- Use a single persistent DB with per-export cleanup by cascade.
- Use canonical entities for people and conversations; importer never merges.
- Keep implementation simple and performant with clear invariants.

## Core Model (Option 2b)
- Per-export, per-conversation persons:
  - Each conversation gets its own `person` rows for all participants (even if silent).
  - Persons belong to exactly one conversation; no separate participant table needed.
- Canonicals:
  - `canonical_person` bridges all per-conversation `person` rows representing the same human.
  - `canonical_conversation` bridges all per-export `conversation` rows representing the same chat thread.
- Messages reference only the sender (user); conversation is inferred via `user.conversation_id`.

## Schema (DDL Outline)
- export
  - id PK
  - source TEXT NOT NULL (‘messenger:facebook’, ‘messenger:e2e’)
  - checksum TEXT
  - imported_at INTEGER NOT NULL DEFAULT unixepoch('now')
  - meta_json TEXT (store file_count and per-file hashes)
- canonical_person
  - id PK, display_name TEXT, avatar_uri TEXT, created_at INTEGER DEFAULT unixepoch('now')
- canonical_conversation
  - id PK, type TEXT NOT NULL CHECK IN ('dm','group'), name TEXT, created_at INTEGER DEFAULT unixepoch('now')
- conversation
  - id PK, type TEXT NOT NULL, image_uri TEXT, name TEXT
  - export_id INTEGER NOT NULL REFERENCES export(id) ON DELETE CASCADE
  - canonical_conversation_id INTEGER NOT NULL REFERENCES canonical_conversation(id)
- user
  - id PK, conversation_id INTEGER NOT NULL REFERENCES conversation(id) ON DELETE CASCADE
  - name TEXT, avatar_uri TEXT
  - canonical_person_id INTEGER NOT NULL REFERENCES canonical_person(id)
- message
  - id PK, sender INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE
  - sent_at INTEGER NOT NULL
  - unsent INTEGER NOT NULL DEFAULT 0
- message_text / image / video / gif / audio
  - id PK, message_id INTEGER NOT NULL REFERENCES message(id) ON DELETE CASCADE
  - payload fields (e.g., text, uri, length_seconds for audio)
- reaction
  - id PK, reactor_id INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE
  - message_id INTEGER NOT NULL REFERENCES message(id) ON DELETE CASCADE
  - reaction TEXT

Remove: `conversation.export_source`, `message.conversation` (now derived via sender).

## Indexes
- person(conversation_id, id)
- person(canonical_person_id)
- conversation(export_id)
- conversation(canonical_conversation_id)
- message(sender, sent_at)
- reaction(message_id)

## Checksum + Grouping
- Per-file hash: SHA‑256 over file bytes and record file size.
- Group checksum:
  - Sort entries by raw hash bytes ascending.
  - Hash the stream: for each file, write `hash_bytes || size_u64_le` into a SHA‑256 hasher.
  - Final digest is group checksum.
  - Store `file_count` and per-file hashes in `export.meta_json`.
- Grouping rule:
  - In one import run: all Facebook zips = one export; each E2E zip = its own export.

## Importer Behavior
- Use SQLite-generated ids; `WriteBatch` returns inserted ids.
- Per export group (Facebook) or per file (E2E):
  - Create one `export` row with source + group checksum.
- For each conversation in the export:
  - Create `canonical_conversation` (1:1 initially).
  - Create `conversation` with export_id + canonical_conversation_id.
  - Create per-conversation `person` rows for all participants (even if silent):
    - For each, create a `canonical_person` and link via `person.canonical_person_id` (1:1 initially).
- For each message:
  - Map `sender_name` to the per-conversation `person` id.
  - Insert `message(sender, sent_at)` and content rows.
  - Probe audio durations as today (global file index across selected paths).
- No merging or dedup across formats in Rust.

## CLI Behavior
- Keep the current heuristic (DMs with same name across facebook/e2e).
- Apply non-destructively:
  - Assign the same `canonical_conversation_id` to matched pairs.
  - Do not move messages or delete conversations.
- Keep unmatched as-is (each retains its own canonical). Print a summary.

## Merging/Unmerging Rules
- Person merge:
  - Reassign `person.canonical_person_id` across selected users to the target canonical.
  - Delete unreferenced `canonical_person` rows immediately.
- Conversation merge:
  - Reassign `conversation.canonical_conversation_id` across selected conversations to the target canonical.
  - Delete unreferenced `canonical_conversation` rows immediately.
- Undo = reassign FKs back; immediately delete any now-orphaned canonicals.

## Deletion Semantics
- Deleting an export cascades: export → conversation → person → message → message_* and reaction.
- Deleting a person removes their messages and their reactions; deleting a message removes its reactions.

## Query Patterns
- Conversation timeline:
  - `SELECT m.* FROM message m JOIN person p ON p.id = m.sender WHERE p.conversation_id = ? ORDER BY m.sent_at;`
- Canonical person timeline:
  - `SELECT m.* FROM message m JOIN person p ON p.id = m.sender WHERE p.canonical_person_id = ? ORDER BY m.sent_at;`
- Participants for conversation:
  - `SELECT DISTINCT p.* FROM person p WHERE p.conversation_id = ?;`

## Pragmas
- Use: `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=5000`, `foreign_keys=ON`.
- Remove contradictory `journal_mode=OFF` and `synchronous=OFF`.

## No Migrations Policy
- Active development: no backward-compatible migrations; recreate DBs as needed.

## Implementation Steps
1) Schema
   - Replace initial migration to create the new schema (tables, FKs with cascades, indexes).
   - Remove legacy columns: `conversation.export_source`, `message.conversation`, legacy indexes.
2) WriteBatch API
   - Insert helpers return ids: `insert_export`, `insert_canonical_person`, `insert_canonical_conversation`, `insert_conversation`, `insert_person`, `insert_message`, plus content and reaction insertors.
   - Drop explicit `id` arguments; use SQLite rowids / RETURNING.
3) Import state and helpers
   - Remove manual id counters.
   - Maintain per-conversation person map keyed by `(conversation_id, name)` to avoid duplicate inserts in the same conversation during a run.
   - Build global file index once per run for audio probing.
4) Facebook importer
   - Group all selected FB zips as one export.
   - For each thread JSON: create canonical+conversation; create per-conversation persons for participants; import messages; attach media and reactions.
5) E2E importer
   - One export per zip; same per-conversation person creation and message import approach.
6) CLI
   - Remove destructive merge; implement non-destructive canonical assignment for matched DMs. Keep unmatched unchanged.
   - Keep logs; no destructive actions.
7) Cleanup utilities
   - Add functions to delete unused `canonical_*` rows after reassignment.
   - Add simple delete-by-export function (one SQL DELETE on `export`).
8) Validation
   - Build, clippy. Manual import runs to verify cascades, merge behavior, and query patterns.
