
Chat export and analysis app. Users import chats from various communicators, the app computes insights on‑device. The Expo mobile app offloads intensive processing to a shared Rust library for performance and cross‑platform parity. For now we only need to support ios:

## The intended flow:
1. Onboarding:
	1. The user is greeted by a splash screen explaining what the app does to hook them in
	2. User picks from a list of communicators, like Messenger, Whatsapp etc.
	3. After picking one of the communicators, user is taken to a flow which explains how to export their data. Includes a PiP video playing step-by-step instructions.
	4. After exporting their data, either user goes to next step, or if export is expected to happen after a long time (like waiting for facebook export), we send a notification in 2, 3 days or something
2. Importing data, creating normalized messages DB:
	1. User selects the data export artifacts, like the related zip file or zip files.
	2. The file info is passed to the rust project, which reads the artifacts, and processes them
	3. Rust project outputs processed data into a SQL database. 
3. Generating stats (extend normalized messages DB, add additional data, not necessarily tied to a single message):
	1. UNDECIDED:
		1. Generate helper table which contains useful stuff, end result is so that we can later generate rest of stats pretty much on the fly (to allow also smooth operation of last year, month, week selectors. Ideally we would only be making queries to the sqlite db)
		2. We add additional tables if needed, like a table which records each instance of people laughing at messages, or a long wait for a response to a message
		3. 
4. Using the app:
	1. App reads the data from the sqlite databases, and makes sqlite commands to fetch data for stats
	2. Header - Our app name, and a dropdown to pick a communicator (Messenger, whatsapp)
	3. Bottom Bar:
		1. Global stats - compare chats between people - who do you text the most with, at what time do you text who the most, with whom do you have the largest texting streak
		2. Personal stats - For DM's, group chats,
		3. Maybe settings?

## Some implementation details
 - We need to have a shared format for all communicators, kind of like an adapter pattern.
 - Th

## Normalized Database Schema (current)

Tables:
- export
  - id
  - source: 'messenger:facebook' | 'messenger:e2e'
  - imported_at: integer (unixepoch)
  - meta_json: JSON string with file list and counts (no checksums)
- canonical_person
  - id
  - display_name
  - avatar_uri
  - created_at: integer (unixepoch)
- canonical_conversation
  - id
  - type: 'dm' | 'group'
  - name
  - created_at: integer (unixepoch)
- conversation
  - id
  - type: 'dm' | 'group'
  - image_uri
  - name
  - export_id: FK export.id ON DELETE CASCADE
  - canonical_conversation_id: FK canonical_conversation.id
- person
  - id
  - conversation_id: FK conversation.id ON DELETE CASCADE
  - name
  - avatar_uri
  - canonical_person_id: FK canonical_person.id
- message
  - id
  - sender: FK person.id ON DELETE CASCADE
  - sent_at: integer (unixepoch seconds)
- message_text
  - message_id: FK message.id ON DELETE CASCADE
  - text: string
- message_image
  - message_id: FK message.id ON DELETE CASCADE
  - image_uri: string
- message_video
  - message_id: FK message.id ON DELETE CASCADE
  - video_uri: string
- message_gif
  - message_id: FK message.id ON DELETE CASCADE
  - gif_uri: string
- message_audio
  - message_id: FK message.id ON DELETE CASCADE
  - audio_uri: string
  - length_seconds: integer
- reaction
  - id
  - reactor_id: FK person.id ON DELETE CASCADE
  - message_id: FK message.id ON DELETE CASCADE
  - reaction: string (emoji)

Notes:
- Messages reference only the sender (person). The conversation is inferred by joining sender → person.conversation_id.
- Deleting an export removes its conversations → persons → messages → content/reactions via cascades.

Indexes (recommended):
- person(conversation_id, id)
- person(canonical_person_id)
- conversation(export_id)
- conversation(canonical_conversation_id)
- message(sender, sent_at)
- reaction(message_id)

## Project Structure:
The Expo mobile app offloads intensive processing to a shared Rust library for performance and cross‑platform parity. For now we only support iOS.
### Repository layout (what lives where)
- `apps/mobile-client`: Expo app and native bridge.
  - UI: `apps/mobile-client/app`, `apps/mobile-client/components`
  - Bridge: `apps/mobile-client/modules/processor-bridge` (iOS)
  - Config: [apps/mobile-client/project.json](mdc:apps/mobile-client/project.json)
  - Relevant NX targets:
    - `sync-processor`: runs [apps/mobile-client/modules/processor-bridge/ios/scripts/sync-processor.sh](mdc:apps/mobile-client/modules/processor-bridge/ios/scripts/sync-processor.sh) and depends on `processor:build-ios`, imports the updated XCFramework and headers
- `libs/processor`: Rust processing core shared by mobile/CLI.
  - Source: `libs/processor/src` (e.g., [libs/processor/src/lib.rs](mdc:libs/processor/src/lib.rs))
  - Artifacts: `libs/processor/dist/` (XCFramework, headers)
  - Relevant NX targets:
    - `build-ios`: runs [libs/processor/build-ios.sh](mdc:libs/processor/build-ios.sh) and produces XCFramework and headers
- `apps/processor-cli`: Rust CLI for local verification.
  - Entry: [apps/processor-cli/src/main.rs](mdc:apps/processor-cli/src/main.rs)

### Native bridge (JS ↔ iOS)
- Module registration: [apps/mobile-client/modules/processor-bridge/expo-module.config.json](mdc:apps/mobile-client/modules/processor-bridge/expo-module.config.json)
- JS API surface: [ProcessorBridgeModule.ts](mdc:apps/mobile-client/modules/processor-bridge/src/ProcessorBridgeModule.ts)
- Native implementations live under:
  - iOS: `apps/mobile-client/modules/processor-bridge/ios`
  - Android: there is a folder for that, but ignore it. We don't support Android yet.
- If there is a linter error like `No such module 'ExpoModulesCore'`, ignore it.

### Rust processing library (`libs/processor`)
- Crate exports FFI symbols used by the bridge.
- Build produces `Processor.xcframework` and C headers under `libs/processor/dist/` for consumption by the iOS bridge.
- Shared crate is also consumed by the CLI, which is used for testing.


## Questions to answer
 - How to handle multi communicators? Should wy try and connect people between communicators, like John Appleseed from Messenger and whatsapp is merged?
 - Various communicators have different features, or some features might not be supported. Because of this, not merging might be a good idea, to reduce inconsistencies.
 - Should we have a sqlite database for each communicator, or one db for all communicators?
 - What exactly does the rust script need to run?
