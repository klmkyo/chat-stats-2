# Repository Guidelines

## Explainer: Purpose & Flow
- Purpose: on-device chat analytics. Users import chat exports; processing runs locally, no server.
- Flow: the mobile app calls a native bridge that invokes the Rust `processor` to parse exports (e.g., Messenger/E2E), normalize into SQLite, and compute metadata (like audio duration). The UI queries results to render insights.
- Project roles:
  - `libs/processor`: Rust core (parsers, DB schema/ops, FFI, media utils); produces `Processor.xcframework` for iOS and is shared by CLI.
  - `apps/mobile-client`: Expo React Native UI and native bridge; vendors Rust artifacts and orchestrates imports.
  - `apps/processor-cli`: Rust CLI for local verification and DB workflows mirroring the app logic.
- Platform status: iOS supported; Android scaffolding exists but is inactive.

## Project Structure & Module Organization
- Monorepo managed by Nx + pnpm; Rust workspace via Cargo.
- `apps/mobile-client` — Expo React Native app (Expo Router). Native `ios/` and `android/` present; iOS vendoring happens under `modules/processor-bridge/ios/Vendored/Processor`.
- `apps/processor-cli` — Rust CLI app depending on the `processor` crate.
- `libs/processor` — Rust library (database, importers, FFI, utils). Integration tests live in `libs/processor/tests/`. Build outputs go to each project’s `dist/`.
- `chat-stats-documentation` — supplementary docs.

## Architecture Overview
- On-device analytics: the Expo app calls a native bridge that forwards to the Rust `processor` crate; iOS is the primary target.
- Rust builds to `Processor.xcframework` via `libs/processor/build-ios.sh`, then is vendored into the iOS bridge.
- Vendoring flow: `pnpm nx run mobile-client:sync-processor` runs `apps/mobile-client/modules/processor-bridge/ios/scripts/sync-processor.sh` and depends on `processor:build-ios`.
- Expo module wiring: `apps/mobile-client/modules/processor-bridge/expo-module.config.json` and TS API `apps/mobile-client/modules/processor-bridge/src/ProcessorBridgeModule.ts`.

## Processor Details
- Inputs: one or more Messenger exports. Supports both legacy Facebook ZIPs and newer end‑to‑end (E2E) ZIPs; JSON files are also accepted in the CLI. Format is auto‑detected per file.
- Normalization (non‑destructive, canonical model):
  - `export` — one row per import group (all selected Facebook ZIPs are one export; each E2E ZIP is its own export). `meta_json` lists file paths; no checksums.
  - `canonical_person`, `canonical_conversation` — identities used to unify entities across exports.
  - `conversation` — per‑export instance with `type`, `image_uri`, `name`, `export_id`, `canonical_conversation_id`.
  - `person` — per‑conversation participant with `conversation_id`, `name`, `avatar_uri`, `canonical_person_id`.
  - `message` — references only `sender` (a `person`); conversation inferred via `person.conversation_id`.
  - Content tables: `message_text`, `message_image`, `message_video`, `message_gif`, `message_audio(length_seconds)`; `reaction(reactor_id, message_id)`.
  - Cascades: deleting an `export` deletes its conversations → persons → messages → content/reactions. Deleting a `person` deletes their messages and reactions; deleting a `message` deletes its reactions.
- Media handling: a global file index resolves media across multiple ZIPs. Audio length is computed in‑house (no ffmpeg at runtime) and stored as `message_audio.length_seconds`.
- Output: one DB file ready for the app to open and query. Example with CLI:
  - `pnpm nx run processor-cli:run -- normalize-messenger --db dist/chats.sqlite exports/messenger_*.zip`
- Post‑processing: the CLI performs non‑destructive linking of duplicate DM conversations across formats by assigning the same `canonical_conversation_id` (no message moves, no deletes). Unmatched remain as‑is.
- Client access: the Expo client should obtain stats by querying the SQLite DB directly, with minimal JS postprocessing. Prefer moving heavy or reusable aggregations into SQL or the processor.

## Build, Test, and Development Commands
- Install deps: `pnpm install`
- Mobile app
  - Start dev server: `pnpm nx run mobile-client:start` (alt: `pnpm --filter mobile-client start`)
  - iOS/Android: `pnpm --filter mobile-client ios` | `pnpm --filter mobile-client android`
  - Prebuild + vendor Rust (iOS): `pnpm nx run mobile-client:prebuild` (runs `sync-processor` first)
- Rust library (processor)
  - Build: `pnpm nx build processor`
  - iOS static libs: `pnpm nx run processor:build-ios`
  - Test: `pnpm nx test processor` (alt: `cargo test -p processor`)
- CLI
  - Build: `pnpm nx build processor-cli`
  - Run: `pnpm nx run processor-cli:run -- --help`
- Lint
  - TS/Expo: `pnpm --filter mobile-client lint`
  - Rust: `pnpm nx lint processor` and `pnpm nx lint processor-cli`

## Native Bridge & FFI Notes (iOS)
- Outputs: `libs/processor:build-ios` produces `Processor.xcframework` and C headers in `libs/processor/dist/`, then `mobile-client:sync-processor` vendors them into `apps/mobile-client/modules/processor-bridge/ios/Vendored/Processor`.
- Exporting new Rust APIs: mark functions `#[no_mangle] pub extern "C"` and add to `[export].include` in `libs/processor/cbindgen.toml`. Headers are auto-generated by the build script.
- The SQLite database must be created and migrated on the JS side (Drizzle). Pass the resulting file path directly to the Rust FFI when importing or querying (see `ProcessorBridge.importMessengerChats`).
- Rust emits import progress via `processor_set_progress_callback` (FFI). The bridge forwards these as `onImportProgress` events so JS can display per-JSON progress in the Messenger import modal. JS now drives file selection with `expo-document-picker` and passes the chosen archive paths into `ProcessorBridge.importMessengerArchives`; the old native ZIP picker has been removed.
- Hooking up JS: update typings in `apps/mobile-client/modules/processor-bridge/src/ProcessorBridgeModule.ts` and call the new symbol from the iOS module.
- Tip: IDE lint like “No such module 'ExpoModulesCore'” can be ignored; `prebuild` sets it up.
- Mobile theming: use the `useTheme()` hook from `common/providers/ThemeProvider` and NativeWind utility classes (`bg-background`, `bg-card`, `text-text`, etc.) wired through CSS variables in `ColorThemesHex`. Prefer Tailwind/NativeWind for layout; fall back to inline styles only for dynamic effects (e.g., shadows).
- Import flow: the chats tab drives imports via the modal wizard in `ChatsPageContents`. Always open the modal (don’t call the bridge directly) so users can pick a source app, review/skip export instructions, and kick off the FFI import.
- Chats feature structure: prefer placing UI pieces under `features/chats/components`, shared data/hooks under `features/chats/hooks`, and constants under `features/chats/constants`. `ChatsPageContents` should stay lean and compose these pieces.

## Coding Style & Naming Conventions
- TypeScript/React Native: Prettier (2 spaces, single quotes, no semicolons, width 100, trailing commas). ESLint via `eslint.config.expo.mjs` + Nx base; module boundaries enforced.
- Filenames: components PascalCase; general TS/TSX camelCase; routes follow Expo Router under `apps/mobile-client/app`.
- Rust: rustfmt defaults; modules `snake_case`; crates `kebab-case` in Cargo, `snake_case` in code.
- Rust imports: define `use` statements at the top of files; avoid inline `use` inside functions/modules unless there is a specific, documented reason (e.g., narrowing test scope).

## Testing Guidelines
- Rust: unit tests with `#[cfg(test)]`; integration tests in `libs/processor/tests/*.rs` (e.g., `audio_duration.rs`). Some tests rely on `ffmpeg`; when missing, they skip gracefully.
- Run selectively: `cargo test -p processor -- test_name`.
- JS/TS: no dedicated tests yet.

## Commit & Pull Request Guidelines
- Use Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`) consistent with history.
- PRs: include purpose, scope, and verification (logs or screenshots). Link issues. Note Nx targets run (build/test/lint).

## Security & Configuration Tips
- Do not commit `dist/`, generated artifacts, or secrets.
- For iOS builds, ensure `processor:build-ios` precedes `mobile-client:prebuild` (wired via `sync-processor`).

## Agent Notes
- Keep this AGENTS.md updated. When adding features, commands, schema changes, or build/bridge nuances, add concise notes here so future contributors and agents have a single source of truth. You can edit any part of this file.
 - Active development policy: backward-compat migrations are not required. It’s acceptable to change the schema without adding up/down migrations; consumers should recreate local DBs as needed. The CLI currently overwrites the DB path for runs, and the mobile app may drop/rebuild during pre-release.
 - Mobile client Drizzle bindings live in `apps/mobile-client/src/db`. Use `getDatabase()` to obtain a shared Expo SQLite connection (ensures Drizzle migrations run before Rust touches the file) and prefer the query helpers in `db/queries.ts` for shared aggregations.
