CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`session_id` text,
	`filename` text NOT NULL,
	`original_name` text NOT NULL,
	`storage_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`page_count` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`uploaded_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `print_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`size` text DEFAULT 'A4' NOT NULL,
	`color` text DEFAULT 'bw' NOT NULL,
	`sides` text DEFAULT 'single' NOT NULL,
	`paper` text DEFAULT 'normal-90' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `print_configs_file_id_unique` ON `print_configs` (`file_id`);--> statement-breakpoint
CREATE TABLE `print_job_files` (
	`job_id` text NOT NULL,
	`file_id` text NOT NULL,
	PRIMARY KEY(`job_id`, `file_id`),
	FOREIGN KEY (`job_id`) REFERENCES `print_jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `print_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`group_key` text NOT NULL,
	`client_id` text NOT NULL,
	`downloaded_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'client' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);