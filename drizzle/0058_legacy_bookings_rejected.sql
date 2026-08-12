UPDATE `bookings`
SET `status` = 'rejected',
    `updated_at` = strftime('%s', 'now') * 1000
WHERE `source` = 'legacy';
