CREATE TABLE `days` (
	`date` text PRIMARY KEY NOT NULL,
	`raw_entry` text NOT NULL,
	`created_at` text NOT NULL,
	`graded_at` text,
	`ai_narrative` text,
	`weighted_overall_score` real
);
--> statement-breakpoint
CREATE TABLE `dimensions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`weight` integer NOT NULL,
	`success_text` text NOT NULL,
	`constraints_text` text NOT NULL,
	`anti_goals_text` text NOT NULL,
	`additional_info` text,
	`created_at` text NOT NULL,
	CONSTRAINT "dimensions_weight_range" CHECK("dimensions"."weight" BETWEEN 1 AND 10)
);
--> statement-breakpoint
CREATE TABLE `scores` (
	`day_date` text NOT NULL,
	`dimension_id` integer NOT NULL,
	`score` real NOT NULL,
	`hours_estimated` real,
	PRIMARY KEY(`day_date`, `dimension_id`),
	FOREIGN KEY (`day_date`) REFERENCES `days`(`date`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dimension_id`) REFERENCES `dimensions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "scores_score_range" CHECK("scores"."score" BETWEEN 0 AND 10)
);
--> statement-breakpoint
CREATE TABLE `suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day_date` text NOT NULL,
	`dimension_id` integer NOT NULL,
	`rank` integer NOT NULL,
	`text` text NOT NULL,
	`mode` text NOT NULL,
	FOREIGN KEY (`day_date`) REFERENCES `days`(`date`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dimension_id`) REFERENCES `dimensions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "suggestions_rank_positive" CHECK("suggestions"."rank" > 0),
	CONSTRAINT "suggestions_mode_enum" CHECK("suggestions"."mode" IN ('fix', 'stretch'))
);
