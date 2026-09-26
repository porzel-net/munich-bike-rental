-- Preserve historical intake rows while keeping one durable document idempotency owner.
-- The previous application-level duplicate check could race before this constraint existed.
UPDATE `whatsapp_receipt_intake`
SET `document_id` = NULL
WHERE `document_id` IS NOT NULL
  AND `id` NOT IN (
    SELECT MIN(`id`)
    FROM `whatsapp_receipt_intake`
    WHERE `document_id` IS NOT NULL
    GROUP BY `document_id`
  );
--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_receipt_intake_document_unique` ON `whatsapp_receipt_intake` (`document_id`);
