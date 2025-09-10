
Chat export and analysis app. Users import chats from various communicators, the app computes insights on‑device. The Expo mobile app offloads intensive processing to a shared Rust library for performance and cross‑platform parity. For now we only need to support ios:

## The intended flow:
1. Onboarding:
	1. The user is greeted by a splash screen explaining what the app does to hook them in
	2. User picks from a list of communicators, like Messenger, Whatsapp etc.
	3. After picking one of the communicators, user is taken to a flow which explains how to export their data. Includes a PiP video playing step-by-step instructions.
	4. After exporting their data, either user goes to next step, or if export is expected to happen after a long time (like waiting for facebook export), we send a notification in 2, 3 days or something
2. Importing data:
	1. User selects the data export artifacts, like the related zip file or zip files.
	2. The file info is passed to the rust project, which reads the artifacts, and processes them
	3. Rust project outputs processed data into a SQL database
3. Generating stats:
	1. UNDECIDED:
		1. Generate helper table which contains useful stuff, end result is so that we can later generate rest of stats pretty much on the fly (to allow also smooth operation of last year, month, week selectors. Ideally we would only be making queries to the sqlite db)
		2. We add additional tables if needed, like a table which records each instance of people laughing at messages, or a long wait for a response to a message
4. Using the app:
	1. Header - Our app name, and a dropdown to pick a communicator (Messenger, whatsapp)
	2. Bottom Bar:
		1. Global stats - compare chats between people - who do you text the most with, at what time do you text who the most, with whom do you have the largest texting streak
		2. Personal stats - For DM's, group chats,
		3. Maybe settings?

## Some implementation details
 - We need to have a shared format for all communicators, kind of like an adapter pattern.
 - Th

## Normalized Database Schema

Tables:
 - user
	 - id
	 - external_id
	 - name
	 - avatar_url
 - conversation
	 - id
	 - type: 'dm' | 'group'
	 - participants: FK user.id
	 - image: string // either other participant img or GC image
	 - name: string // either other participant user name or GC username
 - message
	 - id
	 - sender: FK user.id
	 - type: 'text' | 'image' | 'gif' | 'audio' | 'video' // we don't support mixed, split up into multiple messages if needed. Only one image at once too.
	 - sent_at: Date
	 - REFERENCED IN:
		 - reaction
 - reaction:
	 - id
	 - reactor_id: FK user.id
	 - message_id: FK message_id
	 - reaction: String (or whatever is enough for one emoji)

TODO: How to store message contents? Ideally, we'd store the text contents of course, but for audio messages, we'd like to store metadata, like audio length. Should we just have nullable fields in message, or separate tables somehow?


## Questions to answer
 - How to handle multi communicators? Should wy try and connect people between communicators, like John Appleseed from Messenger and whatsapp is merged?
 - Various communicators have different features, or some features might not be supported. Because of this, not merging might be a good idea, to reduce inconsistencies.
 - Should we have a sqlite database for each communicator, or one db for all communicators?
 - What exactly does the rust script need to run?
 - 