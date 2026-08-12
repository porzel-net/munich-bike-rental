CREATE TABLE `auth_invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`location_key` text,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT `auth_invitation_role_check` CHECK (`role` in ('admin', 'standortuser')),
	CONSTRAINT `auth_invitation_location_key_check` CHECK (`location_key` is null or `location_key` in ('munich', 'regensburg', 'lindau', 'friedrichshafen', 'konstanz'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_invitation_token_hash_unique` ON `auth_invitation` (`token_hash`);--> statement-breakpoint
CREATE INDEX `auth_invitation_expires_at_idx` ON `auth_invitation` (`expires_at`);
