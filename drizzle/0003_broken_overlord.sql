CREATE TABLE `catalyst_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`watchlistItemId` int,
	`symbol` varchar(32),
	`source` varchar(64) NOT NULL,
	`externalId` varchar(255),
	`headline` text NOT NULL,
	`summary` text,
	`url` text,
	`sentiment` enum('bullish','bearish','neutral','mixed'),
	`importance` int DEFAULT 50,
	`publishedAt` timestamp,
	`triggeredSimId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `catalyst_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `persona_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`scope` enum('narrative','technical','finance') NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`personas` json NOT NULL,
	`isSystem` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `persona_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `watchlist_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(32) NOT NULL,
	`assetClass` enum('equity','crypto','commodity','forex','index','rate') NOT NULL DEFAULT 'equity',
	`thesis` text,
	`positionSide` enum('long','short','watch') DEFAULT 'watch',
	`ingestSources` json,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `watchlist_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projects` ADD `projectType` enum('narrative','technical','finance') DEFAULT 'narrative' NOT NULL;