CREATE UNIQUE INDEX `financial_document_links_document_transaction_unique` ON `financial_document_links` (`document_id`,`transaction_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'standortuser' NOT NULL,
	`location_key` text,
	`whatsapp_phone` text,
	`banned` integer DEFAULT false NOT NULL,
	`ban_reason` text,
	`ban_expires` integer,
	`must_change_password` integer DEFAULT true NOT NULL,
	`two_factor_enabled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "auth_user_role_check" CHECK("__new_user"."role" in ('admin', 'standortuser')),
	CONSTRAINT "auth_user_location_key_check" CHECK("__new_user"."location_key" is null or "__new_user"."location_key" in ('munich', 'regensburg', 'lindau', 'friedrichshafen', 'konstanz'))
);
--> statement-breakpoint
INSERT INTO `__new_user`("id", "name", "email", "email_verified", "image", "role", "location_key", "whatsapp_phone", "banned", "ban_reason", "ban_expires", "must_change_password", "two_factor_enabled", "created_at", "updated_at") SELECT "id", "name", "email", "email_verified", "image", "role", "location_key", "whatsapp_phone", "banned", "ban_reason", "ban_expires", "must_change_password", "two_factor_enabled", "created_at", "updated_at" FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `auth_user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `auth_user_role_idx` ON `user` (`role`);--> statement-breakpoint
CREATE INDEX `auth_user_location_key_idx` ON `user` (`location_key`);