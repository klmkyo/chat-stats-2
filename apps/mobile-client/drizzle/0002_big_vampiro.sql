PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_export` (
	`id` integer PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`checksum` text,
	`imported_at` integer DEFAULT (unixepoch('now')) NOT NULL,
	`meta_json` text
);
--> statement-breakpoint
INSERT INTO `__new_export`("id", "source", "checksum", "imported_at", "meta_json") SELECT "id", "source", "checksum", "imported_at", "meta_json" FROM `export`;--> statement-breakpoint
DROP TABLE `export`;--> statement-breakpoint
ALTER TABLE `__new_export` RENAME TO `export`;--> statement-breakpoint
PRAGMA foreign_keys=ON;