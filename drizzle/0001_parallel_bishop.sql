CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`agentId` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`persona` text,
	`platform` enum('twitter','reddit') DEFAULT 'twitter',
	`followers` int DEFAULT 0,
	`following` int DEFAULT 0,
	`ideology` varchar(255),
	`properties` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`agentId` varchar(255),
	`role` enum('user','assistant','system') NOT NULL DEFAULT 'user',
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`filename` varchar(500) NOT NULL,
	`mimeType` varchar(100),
	`storageKey` text NOT NULL,
	`storageUrl` text NOT NULL,
	`sizeBytes` int,
	`extractedText` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `graph_edges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`sourceId` varchar(255) NOT NULL,
	`targetId` varchar(255) NOT NULL,
	`label` varchar(255),
	`weight` float DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `graph_edges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `graph_nodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`nodeId` varchar(255) NOT NULL,
	`label` varchar(500) NOT NULL,
	`type` varchar(100) DEFAULT 'entity',
	`description` text,
	`properties` json,
	`x` float,
	`y` float,
	`z` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `graph_nodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('draft','building_graph','graph_ready','setting_up','ready','running','completed','failed') NOT NULL DEFAULT 'draft',
	`topic` varchar(500),
	`platform` enum('twitter','reddit','both') DEFAULT 'both',
	`agentCount` int DEFAULT 10,
	`roundCount` int DEFAULT 5,
	`graphBuilt` boolean DEFAULT false,
	`envReady` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`simulationRunId` int,
	`userId` int NOT NULL,
	`title` varchar(500),
	`content` text,
	`summary` text,
	`status` enum('pending','generating','completed','failed') NOT NULL DEFAULT 'pending',
	`pdfUrl` text,
	`pdfKey` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `simulation_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`simulationRunId` int NOT NULL,
	`projectId` int NOT NULL,
	`round` int DEFAULT 0,
	`agentName` varchar(255),
	`platform` varchar(50),
	`action` varchar(100),
	`content` text,
	`logLevel` enum('info','warn','error','debug') DEFAULT 'info',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `simulation_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `simulation_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`status` enum('pending','running','completed','failed','stopped') NOT NULL DEFAULT 'pending',
	`currentRound` int DEFAULT 0,
	`totalRounds` int DEFAULT 5,
	`platform` enum('twitter','reddit','both') DEFAULT 'both',
	`startedAt` timestamp,
	`completedAt` timestamp,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `simulation_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;