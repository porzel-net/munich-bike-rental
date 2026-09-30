CREATE TABLE `salary_tax_rates` (
	`year` integer PRIMARY KEY NOT NULL,
	`trade_tax_basis_points` integer NOT NULL,
	`vat_basis_points` integer NOT NULL,
	`income_tax_basis_points` integer NOT NULL,
	`updated_by` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "salary_tax_rates_year_check" CHECK("salary_tax_rates"."year" between 2000 and 2200),
	CONSTRAINT "salary_tax_rates_trade_tax_check" CHECK("salary_tax_rates"."trade_tax_basis_points" between 0 and 10000),
	CONSTRAINT "salary_tax_rates_vat_check" CHECK("salary_tax_rates"."vat_basis_points" between 0 and 10000),
	CONSTRAINT "salary_tax_rates_income_tax_check" CHECK("salary_tax_rates"."income_tax_basis_points" between 0 and 10000)
);
