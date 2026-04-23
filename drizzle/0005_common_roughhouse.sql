ALTER TABLE `watchlist_items` MODIFY COLUMN `symbol` varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE `watchlist_items` MODIFY COLUMN `assetClass` enum('equity','crypto','commodity','forex','index','rate','prediction_market') NOT NULL DEFAULT 'equity';--> statement-breakpoint
ALTER TABLE `predictions` ADD `externalSource` varchar(64);--> statement-breakpoint
ALTER TABLE `predictions` ADD `externalRef` varchar(255);--> statement-breakpoint
ALTER TABLE `predictions` ADD `externalProbability` float;--> statement-breakpoint
ALTER TABLE `predictions` ADD `externalLastCheckedAt` timestamp;