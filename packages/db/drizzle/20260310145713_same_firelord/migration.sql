CREATE TABLE `job_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`job_name` text NOT NULL,
	`trigger_type` text NOT NULL,
	`trigger_cron` text,
	`triggered_by` text,
	`status` text NOT NULL,
	`started_at` text DEFAULT (current_timestamp) NOT NULL,
	`completed_at` text,
	`duration_ms` integer,
	`result` text,
	`metrics` text,
	`error` text,
	`error_stack` text,
	`logs` text
);
