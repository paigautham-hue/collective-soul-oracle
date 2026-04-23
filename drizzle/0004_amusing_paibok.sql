CREATE TABLE `llm_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`task` varchar(64) NOT NULL,
	`provider` varchar(32),
	`model` varchar(128),
	`monthKey` varchar(7) NOT NULL,
	`callMs` int,
	`inputTokens` int,
	`outputTokens` int,
	`costEstimateUsd` float,
	`status` enum('ok','error','throttled') DEFAULT 'ok',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `llm_usage_id` PRIMARY KEY(`id`)
);
