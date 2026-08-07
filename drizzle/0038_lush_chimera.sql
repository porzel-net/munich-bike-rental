ALTER TABLE `journal_entries` ADD `idempotency_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `journal_entries_idempotency_unique` ON `journal_entries` (`idempotency_key`);