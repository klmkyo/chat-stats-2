CREATE TABLE `canonical_conversation` (
	`id` integer PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text,
	`created_at` integer DEFAULT (unixepoch('now')) NOT NULL,
	CONSTRAINT "ck_canonical_conversation_type" CHECK("canonical_conversation"."type" in ('dm','group'))
);
--> statement-breakpoint
CREATE TABLE `canonical_person` (
	`id` integer PRIMARY KEY NOT NULL,
	`display_name` text,
	`avatar_uri` text,
	`created_at` integer DEFAULT (unixepoch('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversation` (
	`id` integer PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`image_uri` text,
	`name` text,
	`export_id` integer NOT NULL,
	`canonical_conversation_id` integer NOT NULL,
	FOREIGN KEY (`export_id`) REFERENCES `export`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`canonical_conversation_id`) REFERENCES `canonical_conversation`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_conversation_type" CHECK("conversation"."type" in ('dm','group'))
);
--> statement-breakpoint
CREATE INDEX `idx_conversation_export` ON `conversation` (`export_id`);--> statement-breakpoint
CREATE INDEX `idx_conversation_canonical` ON `conversation` (`canonical_conversation_id`);--> statement-breakpoint
CREATE TABLE `export` (
	`id` integer PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`checksum` text,
	`imported_at` integer DEFAULT (unixepoch('now')) NOT NULL,
	`meta_json` text
);
--> statement-breakpoint
CREATE TABLE `message_audio` (
	`id` integer PRIMARY KEY NOT NULL,
	`message_id` integer NOT NULL,
	`audio_uri` text,
	`length_seconds` integer,
	FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `message_gif` (
	`id` integer PRIMARY KEY NOT NULL,
	`message_id` integer NOT NULL,
	`gif_uri` text,
	FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `message_image` (
	`id` integer PRIMARY KEY NOT NULL,
	`message_id` integer NOT NULL,
	`image_uri` text,
	FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `message_text` (
	`id` integer PRIMARY KEY NOT NULL,
	`message_id` integer NOT NULL,
	`text` text,
	FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `message_video` (
	`id` integer PRIMARY KEY NOT NULL,
	`message_id` integer NOT NULL,
	`video_uri` text,
	FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `message` (
	`id` integer PRIMARY KEY NOT NULL,
	`sender` integer NOT NULL,
	`sent_at` integer NOT NULL,
	`unsent` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`sender`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_message_sender_time` ON `message` (`sender`,`sent_at`);--> statement-breakpoint
CREATE TABLE `person` (
	`id` integer PRIMARY KEY NOT NULL,
	`conversation_id` integer NOT NULL,
	`name` text,
	`avatar_uri` text,
	`canonical_person_id` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`canonical_person_id`) REFERENCES `canonical_person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_person_conversation` ON `person` (`conversation_id`,`id`);--> statement-breakpoint
CREATE INDEX `idx_person_canonical` ON `person` (`canonical_person_id`);--> statement-breakpoint
CREATE TABLE `reaction` (
	`id` integer PRIMARY KEY NOT NULL,
	`reactor_id` integer NOT NULL,
	`message_id` integer NOT NULL,
	`reaction` text,
	FOREIGN KEY (`reactor_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_reaction_message` ON `reaction` (`message_id`);