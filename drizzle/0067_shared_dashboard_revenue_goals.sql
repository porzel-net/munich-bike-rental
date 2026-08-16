CREATE TABLE `dashboard_revenue_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scope_key` text NOT NULL,
	`goal_year` integer NOT NULL,
	`annual_goal_cents` integer DEFAULT 0 NOT NULL,
	`monthly_goal_cents` integer DEFAULT 0 NOT NULL,
	`updated_by` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT `dashboard_revenue_goals_annual_cents_check` CHECK (`annual_goal_cents` > 0),
	CONSTRAINT `dashboard_revenue_goals_monthly_cents_check` CHECK (`monthly_goal_cents` > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dashboard_revenue_goals_scope_year_unique` ON `dashboard_revenue_goals` (`scope_key`,`goal_year`);
--> statement-breakpoint
CREATE INDEX `dashboard_revenue_goals_scope_idx` ON `dashboard_revenue_goals` (`scope_key`);
