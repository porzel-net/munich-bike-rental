CREATE TABLE `whatsapp_receipt_intake` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `whatsapp_message_id` text NOT NULL,
  `sender_user_id` text,
  `document_id` integer,
  `transaction_id` integer,
  `status` text NOT NULL,
  `extracted_amount_cents` integer,
  `match_score` integer,
  `details` text DEFAULT '' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`sender_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`document_id`) REFERENCES `financial_documents`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`transaction_id`) REFERENCES `financial_transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_receipt_intake_message_unique` ON `whatsapp_receipt_intake` (`whatsapp_message_id`);
--> statement-breakpoint
CREATE INDEX `whatsapp_receipt_intake_status_created_idx` ON `whatsapp_receipt_intake` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `whatsapp_receipt_intake_transaction_idx` ON `whatsapp_receipt_intake` (`transaction_id`);
