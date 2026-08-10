ALTER TABLE bookings ADD COLUMN assigned_user_id text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS bookings_assigned_user_idx ON bookings(assigned_user_id);
