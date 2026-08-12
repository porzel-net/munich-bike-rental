ALTER TABLE `rental_location_bikes` ADD `discount_text_de` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `rental_location_bikes` ADD `discount_text_en` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `rental_location_bikes`
SET
  `discount_text_de` = '50%' || char(10) || 'Rabatt insgesamt' || char(10) || 'Vom 6.8.–13.8.' || char(10) || 'Für Größe S',
  `discount_text_en` = '50%' || char(10) || 'Total discount' || char(10) || 'From Aug 6–13' || char(10) || 'For size S'
WHERE `location` = 'munich'
  AND `title` = 'Endurace CF SL 8'
  AND `id` IN (
    SELECT `location_bike_id`
    FROM `rental_location_bike_sizes`
    WHERE `size` = 'S'
  );--> statement-breakpoint
UPDATE `rental_location_bikes`
SET
  `discount_text_de` = '25%' || char(10) || 'Dauerhafter' || char(10) || 'Juli – August' || char(10) || 'Rabatt',
  `discount_text_en` = '25%' || char(10) || 'Permanent' || char(10) || 'July – August' || char(10) || 'Discount'
WHERE `title` = 'Aeroad CF SL 8';
