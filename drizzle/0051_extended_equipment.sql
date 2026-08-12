ALTER TABLE `rental_inquiry_bikes` ADD `needs_bikepacking_bag` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `rental_inquiry_bikes` ADD `needs_glasses` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `rental_inquiry_bikes` ADD `bottle_holder_included` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `rental_inquiry_bikes` ADD `repair_kit_included` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `booking_requested_items` ADD `needs_bikepacking_bag` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `booking_requested_items` ADD `needs_glasses` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `booking_requested_items` ADD `bottle_holder_included` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `booking_requested_items` ADD `repair_kit_included` integer NOT NULL DEFAULT 1;
