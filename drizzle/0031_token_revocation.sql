CREATE TABLE IF NOT EXISTS `token_revoked` (
	`id` text PRIMARY KEY NOT NULL,
	`token_jti` text NOT NULL UNIQUE,
	`user_id` text NOT NULL,
	`revoked_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `token_revoked_user_id_idx` on `token_revoked` (`user_id`);
--> statement-breakpoint
CREATE INDEX `token_revoked_expires_at_idx` on `token_revoked` (`expires_at`);
