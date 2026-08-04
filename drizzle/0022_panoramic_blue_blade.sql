ALTER TABLE `communication_messages` ADD `thread_message_id` text;--> statement-breakpoint
ALTER TABLE `journal_entries` ADD `due_at` integer;--> statement-breakpoint
CREATE TRIGGER `journal_entries_append_only_update`
BEFORE UPDATE ON `journal_entries`
BEGIN
  SELECT RAISE(ABORT, 'journal_entries are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `journal_entries_append_only_delete`
BEFORE DELETE ON `journal_entries`
BEGIN
  SELECT RAISE(ABORT, 'journal_entries are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `journal_lines_append_only_update`
BEFORE UPDATE ON `journal_lines`
BEGIN
  SELECT RAISE(ABORT, 'journal_lines are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `journal_lines_append_only_delete`
BEFORE DELETE ON `journal_lines`
BEGIN
  SELECT RAISE(ABORT, 'journal_lines are append-only');
END;
