ALTER TABLE `uploaded_files` ADD `user_id` text REFERENCES user(id);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_guestbook_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`message` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_guestbook_entries`(`id`, `name`, `message`, `createdAt`) SELECT `id`, `name`, `message`, unixepoch(`createdAt`) FROM `guestbook_entries`;--> statement-breakpoint
DROP TABLE `guestbook_entries`;--> statement-breakpoint
ALTER TABLE `__new_guestbook_entries` RENAME TO `guestbook_entries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_job_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`job_name` text NOT NULL,
	`trigger_type` text NOT NULL,
	`trigger_cron` text,
	`triggered_by` text,
	`status` text NOT NULL,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	`duration_ms` integer,
	`result` text,
	`metrics` text,
	`error` text,
	`error_stack` text,
	`logs` text
);
--> statement-breakpoint
INSERT INTO `__new_job_runs`(`id`, `job_name`, `trigger_type`, `trigger_cron`, `triggered_by`, `status`, `started_at`, `completed_at`, `duration_ms`, `result`, `metrics`, `error`, `error_stack`, `logs`) SELECT `id`, `job_name`, `trigger_type`, `trigger_cron`, `triggered_by`, `status`, unixepoch(`started_at`), unixepoch(`completed_at`), `duration_ms`, `result`, `metrics`, `error`, `error_stack`, `logs` FROM `job_runs`;--> statement-breakpoint
DROP TABLE `job_runs`;--> statement-breakpoint
ALTER TABLE `__new_job_runs` RENAME TO `job_runs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_uploaded_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`filename` text NOT NULL,
	`r2_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`user_id` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_uploaded_files_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__new_uploaded_files`(`id`, `filename`, `r2_key`, `content_type`, `size`, `createdAt`) SELECT `id`, `filename`, `r2_key`, `content_type`, `size`, unixepoch(`createdAt`) FROM `uploaded_files`;--> statement-breakpoint
DROP TABLE `uploaded_files`;--> statement-breakpoint
ALTER TABLE `__new_uploaded_files` RENAME TO `uploaded_files`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `job_runs_jobName_startedAt_idx` ON `job_runs` (`job_name`,`started_at`);--> statement-breakpoint
CREATE INDEX `uploaded_files_userId_idx` ON `uploaded_files` (`user_id`);--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);