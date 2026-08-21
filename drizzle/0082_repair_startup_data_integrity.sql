-- Reconcile databases that were migrated with historical versions of files
-- whose tags were later corrected in-place. The schema and data checks run
-- before this migration have already established that the current database
-- shape is valid; only the journal hashes need to be brought in sync.
UPDATE `__drizzle_migrations`
SET `hash` = '1712996256bbaf3b2e7e93805c0a8f92f3db1d645c7a173c180cfb0570b655fb'
WHERE `created_at` = 1784624248152;
--> statement-breakpoint
UPDATE `__drizzle_migrations`
SET `hash` = 'b4e0497804e46e0a0b0b8c31975b062152d551bac49c3c2e80932567b4085dcd'
WHERE `created_at` = 1784657000000;
--> statement-breakpoint
UPDATE `__drizzle_migrations`
SET `hash` = '8eb08b9b2ae3c6d7ea55619711e3f18e0b5374a30573ee6def52fe1f2acd8456'
WHERE `created_at` = 1784723610562;
--> statement-breakpoint
UPDATE `__drizzle_migrations`
SET `hash` = 'a12e51e02a3a3566745697bb901b8edecb3e3c7d83212ebfc6682f59cf7a9bbd'
WHERE `created_at` = 1784728000000;
--> statement-breakpoint
UPDATE `__drizzle_migrations`
SET `hash` = 'fb1461b1b851d756d0d2206ad7304e8502f87e9cbc59562937bd54f51fecbb3e'
WHERE `created_at` = 1785950211800;
--> statement-breakpoint
UPDATE `__drizzle_migrations`
SET `hash` = '6da5d6ff1d4762aba50fe4fba0795114fc7eb0c7c889e5685531db8b2830120d'
WHERE `created_at` = 1785954600000;
--> statement-breakpoint
UPDATE `__drizzle_migrations`
SET `hash` = '64701d003ed0ead610e5cd6973205ac6169c363737ba3fa202ea61421895b26c'
WHERE `created_at` = 1786755600000;
--> statement-breakpoint
UPDATE `__drizzle_migrations`
SET `hash` = '562e32102a7342f707f57c329887137ece43c460756a30fd42ca656d52c72b82'
WHERE `created_at` = 1786901000000;
--> statement-breakpoint
UPDATE `__drizzle_migrations`
SET `hash` = 'a4b092670c4027c7fcdbe7083ee7590d32d798b0a086643a69261f33f84ea0dc'
WHERE `created_at` = 1787139004000;
--> statement-breakpoint

-- A posted transaction must have a complete allocation. Preserve every
-- source row and send malformed historical postings back to review instead
-- of allowing them to prevent the application from starting.
UPDATE `financial_transactions`
SET
  `status` = 'needs_review',
  `notes` = trim(
    CASE
      WHEN `notes` = '' THEN 'Automatische Startup-Reparatur: unvollständige Finanzzuordnung; bitte prüfen.'
      ELSE `notes` || char(10) || 'Automatische Startup-Reparatur: unvollständige Finanzzuordnung; bitte prüfen.'
    END
  ),
  `reconciled_at` = NULL,
  `reconciled_by_user_id` = NULL,
  `updated_at` = unixepoch('now') * 1000
WHERE `status` = 'posted'
  AND COALESCE(
    (SELECT SUM(`amount_cents`) FROM `financial_transaction_allocations` a WHERE a.`transaction_id` = `financial_transactions`.`id`),
    0
  ) <> `amount_cents`;
