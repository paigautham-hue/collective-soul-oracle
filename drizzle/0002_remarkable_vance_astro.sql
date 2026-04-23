CREATE TABLE `agent_memories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`agentId` varchar(255) NOT NULL,
	`simulationRunId` int,
	`round` int DEFAULT 0,
	`kind` enum('observation','action','reflection','fact') NOT NULL DEFAULT 'observation',
	`content` text NOT NULL,
	`embedding` json,
	`salience` float NOT NULL DEFAULT 1,
	`decayedAt` timestamp,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_memories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `graph_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`simulationRunId` int,
	`round` int DEFAULT 0,
	`eventType` enum('node_added','node_updated','edge_added','edge_strengthened','edge_weakened') NOT NULL,
	`refNodeId` varchar(255),
	`refEdgeFrom` varchar(255),
	`refEdgeTo` varchar(255),
	`delta` json,
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `graph_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `predictions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`simulationRunId` int,
	`reportId` int,
	`claim` text NOT NULL,
	`predictedOutcome` text NOT NULL,
	`confidence` float NOT NULL,
	`confidenceBandLow` float,
	`confidenceBandHigh` float,
	`horizonDays` int,
	`resolutionDate` timestamp,
	`groundTruth` text,
	`groundTruthSource` text,
	`brierScore` float,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `predictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `share_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`reportId` int,
	`userId` int NOT NULL,
	`slug` varchar(64) NOT NULL,
	`scope` enum('report','project_readonly') NOT NULL DEFAULT 'report',
	`expiresAt` timestamp,
	`views` int NOT NULL DEFAULT 0,
	`revoked` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `share_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `share_links_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `simulation_branches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`parentRunId` int,
	`simulationRunId` int NOT NULL,
	`label` varchar(255) NOT NULL,
	`perturbation` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `simulation_branches_id` PRIMARY KEY(`id`)
);
