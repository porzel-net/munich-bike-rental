ALTER TABLE `carddav_sync_jobs` ADD `revision` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `carddav_sync_on_booking_insert`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `carddav_sync_on_booking_update`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `carddav_sync_on_booking_delete`;
--> statement-breakpoint
CREATE TRIGGER `carddav_sync_on_booking_insert` AFTER INSERT ON `bookings` BEGIN
  INSERT INTO `carddav_sync_jobs` (`job_key`, `requested_at`, `next_attempt_at`, `attempts`, `revision`, `last_error`)
  VALUES ('contacts', unixepoch('now') * 1000, unixepoch('now') * 1000, 0, 0, NULL)
  ON CONFLICT(`job_key`) DO UPDATE SET `requested_at` = excluded.`requested_at`, `next_attempt_at` = excluded.`next_attempt_at`, `attempts` = 0, `revision` = `carddav_sync_jobs`.`revision` + 1, `last_error` = NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `carddav_sync_on_booking_update` AFTER UPDATE ON `bookings` BEGIN
  INSERT INTO `carddav_sync_jobs` (`job_key`, `requested_at`, `next_attempt_at`, `attempts`, `revision`, `last_error`)
  VALUES ('contacts', unixepoch('now') * 1000, unixepoch('now') * 1000, 0, 0, NULL)
  ON CONFLICT(`job_key`) DO UPDATE SET `requested_at` = excluded.`requested_at`, `next_attempt_at` = excluded.`next_attempt_at`, `attempts` = 0, `revision` = `carddav_sync_jobs`.`revision` + 1, `last_error` = NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `carddav_sync_on_booking_delete` AFTER DELETE ON `bookings` BEGIN
  INSERT INTO `carddav_sync_jobs` (`job_key`, `requested_at`, `next_attempt_at`, `attempts`, `revision`, `last_error`)
  VALUES ('contacts', unixepoch('now') * 1000, unixepoch('now') * 1000, 0, 0, NULL)
  ON CONFLICT(`job_key`) DO UPDATE SET `requested_at` = excluded.`requested_at`, `next_attempt_at` = excluded.`next_attempt_at`, `attempts` = 0, `revision` = `carddav_sync_jobs`.`revision` + 1, `last_error` = NULL;
END;
