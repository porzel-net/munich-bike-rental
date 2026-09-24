-- Road cycling glasses are now included with the rental at no extra charge.
UPDATE `accessory_inventory`
SET `price_cents` = 0
WHERE `accessory_key` = 'glasses';
