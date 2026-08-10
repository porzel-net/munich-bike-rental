CREATE TABLE `nevlo_oauth_tokens` (
	`id` integer PRIMARY KEY NOT NULL,
	`access_token_ciphertext` text NOT NULL,
	`refresh_token_ciphertext` text NOT NULL,
	`access_token_expires_at` integer,
	`updated_at` integer NOT NULL,
	CONSTRAINT `nevlo_oauth_tokens_singleton_check` CHECK (`id` = 1)
);
