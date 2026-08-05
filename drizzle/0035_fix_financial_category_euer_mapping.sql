-- EÜR treatment is derived from the selected financial category. The legacy
-- travel category was created before the EÜR columns existed and therefore
-- kept the default `needs_review` value by mistake.
UPDATE `financial_categories`
SET `euer_treatment` = 'expense',
    `euer_line` = 'travel',
    `updated_at` = strftime('%s','now') * 1000
WHERE `code` = 'travel';
