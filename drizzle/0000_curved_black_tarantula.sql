CREATE TABLE `user_stores` (
	`user_email` text PRIMARY KEY NOT NULL,
	`store_json` text NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
