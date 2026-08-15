CREATE TABLE `carddav_sync_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_key` text NOT NULL,
	`requested_at` integer NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `carddav_sync_jobs_key_unique` ON `carddav_sync_jobs` (`job_key`);
--> statement-breakpoint
CREATE TRIGGER `carddav_sync_on_booking_insert`
AFTER INSERT ON `bookings`
BEGIN
  INSERT INTO `carddav_sync_jobs` (`job_key`, `requested_at`, `next_attempt_at`, `attempts`, `revision`, `last_error`)
  VALUES ('contacts', unixepoch('now') * 1000, unixepoch('now') * 1000, 0, 0, NULL)
  ON CONFLICT(`job_key`) DO UPDATE SET
    `requested_at` = excluded.`requested_at`,
    `next_attempt_at` = excluded.`next_attempt_at`,
    `attempts` = 0,
    `revision` = `carddav_sync_jobs`.`revision` + 1,
    `last_error` = NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `carddav_sync_on_booking_update`
AFTER UPDATE ON `bookings`
BEGIN
  INSERT INTO `carddav_sync_jobs` (`job_key`, `requested_at`, `next_attempt_at`, `attempts`, `revision`, `last_error`)
  VALUES ('contacts', unixepoch('now') * 1000, unixepoch('now') * 1000, 0, 0, NULL)
  ON CONFLICT(`job_key`) DO UPDATE SET
    `requested_at` = excluded.`requested_at`,
    `next_attempt_at` = excluded.`next_attempt_at`,
    `attempts` = 0,
    `revision` = `carddav_sync_jobs`.`revision` + 1,
    `last_error` = NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `carddav_sync_on_booking_delete`
AFTER DELETE ON `bookings`
BEGIN
  INSERT INTO `carddav_sync_jobs` (`job_key`, `requested_at`, `next_attempt_at`, `attempts`, `revision`, `last_error`)
  VALUES ('contacts', unixepoch('now') * 1000, unixepoch('now') * 1000, 0, 0, NULL)
  ON CONFLICT(`job_key`) DO UPDATE SET
    `requested_at` = excluded.`requested_at`,
    `next_attempt_at` = excluded.`next_attempt_at`,
    `attempts` = 0,
    `revision` = `carddav_sync_jobs`.`revision` + 1,
    `last_error` = NULL;
END;
--> statement-breakpoint
INSERT INTO `carddav_sync_jobs` (`job_key`, `requested_at`, `next_attempt_at`, `attempts`, `revision`, `last_error`)
VALUES ('contacts', unixepoch('now') * 1000, unixepoch('now') * 1000, 0, 0, NULL)
ON CONFLICT(`job_key`) DO NOTHING;
