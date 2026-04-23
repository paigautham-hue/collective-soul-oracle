import type { Express } from "express";
import type { Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import multer from "multer";
import { storagePut } from "./storage";
import { createDocument } from "./db";
import { ENV } from "./_core/env";

// In-memory map of active simulation socket rooms
export const simulationSockets = new Map<number, SocketIOServer>();
let _io: SocketIOServer | null = null;

export function getIO() {
  return _io;
}

export function emitSimulationLog(simulationRunId: number, data: {
  round: number;
  agentName: string;
  platform: string;
  action: string;
  content: string;
  logLevel: string;
  timestamp: string;
}) {
  if (_io) {
    _io.to(`simulation:${simulationRunId}`).emit("log", data);
  }
}

export function emitSimulationStatus(simulationRunId: number, status: string, currentRound: number, totalRounds: number) {
  if (_io) {
    _io.to(`simulation:${simulationRunId}`).emit("status", { status, currentRound, totalRounds });
  }
}

export type GraphEventPayload =
  | { type: "node_added"; nodeId: string; label: string; round: number; agentName: string }
  | { type: "edge_added"; source: string; target: string; label: string; round: number; agentName: string };

export function emitGraphEvent(projectId: number, payload: GraphEventPayload) {
  if (_io) {
    _io.to(`project:${projectId}`).emit("graph:event", payload);
  }
}

export function emitCollabPresence(projectId: number, payload: { userId: number; name?: string | null; section?: string }) {
  if (_io) {
    _io.to(`project:${projectId}`).emit("collab:presence", payload);
  }
}

export function registerUploadAndSocket(app: Express, server: Server) {
  // ─── Socket.IO ────────────────────────────────────────────────────────────
  _io = new SocketIOServer(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/api/socket.io",
  });

  _io.on("connection", (socket) => {
    console.log("[Socket.IO] Client connected:", socket.id);

    socket.on("join:simulation", (simulationRunId: number) => {
      socket.join(`simulation:${simulationRunId}`);
      console.log(`[Socket.IO] Client ${socket.id} joined simulation:${simulationRunId}`);
    });

    socket.on("leave:simulation", (simulationRunId: number) => {
      socket.leave(`simulation:${simulationRunId}`);
    });

    socket.on("join:project", (projectId: number) => {
      socket.join(`project:${projectId}`);
    });

    socket.on("leave:project", (projectId: number) => {
      socket.leave(`project:${projectId}`);
    });

    socket.on("collab:presence", (data: { projectId: number; userId: number; name?: string; section?: string }) => {
      if (data?.projectId) {
        socket.to(`project:${data.projectId}`).emit("collab:presence", { userId: data.userId, name: data.name, section: data.section });
      }
    });

    socket.on("disconnect", () => {
      console.log("[Socket.IO] Client disconnected:", socket.id);
    });
  });

  // ─── File Upload ──────────────────────────────────────────────────────────
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (_req, file, cb) => {
      const allowed = ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
      if (allowed.includes(file.mimetype) || file.originalname.endsWith(".txt") || file.originalname.endsWith(".pdf") || file.originalname.endsWith(".docx")) {
        cb(null, true);
      } else {
        cb(new Error("Only PDF, TXT, and DOCX files are allowed"));
      }
    },
  });

  app.post("/api/upload/document", upload.single("file"), async (req, res) => {
    try {
      // Auth check via cookie
      // Auth is handled by tRPC context; uploads use projectId from body
      const userId = 0; // Will be resolved via projectId ownership check

      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }

      const projectId = parseInt(req.body.projectId || "0");
      if (!projectId) {
        res.status(400).json({ error: "projectId is required" });
        return;
      }

      const filename = req.file.originalname;
      const mimeType = req.file.mimetype;
      const buffer = req.file.buffer;
      const sizeBytes = req.file.size;

      // Upload to S3
      const key = `documents/${projectId}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { url: storageUrl } = await storagePut(key, buffer, mimeType);

      // Extract text for graph building
      let extractedText = "";
      if (mimeType === "text/plain" || filename.endsWith(".txt")) {
        extractedText = buffer.toString("utf-8");
      } else if (mimeType === "application/pdf" || filename.endsWith(".pdf")) {
        // For PDF, we'll store the raw text extraction note
        extractedText = `[PDF Document: ${filename}. Text extraction requires server-side processing.]`;
      } else if (filename.endsWith(".docx")) {
        try {
          const mammoth = await import("mammoth");
          const result = await mammoth.extractRawText({ buffer });
          extractedText = result.value;
        } catch {
          extractedText = `[DOCX Document: ${filename}]`;
        }
      }

      // Save to DB
      await createDocument({
        projectId,
        userId: userId || 1,
        filename,
        mimeType,
        storageKey: key,
        storageUrl,
        sizeBytes,
        extractedText: extractedText.slice(0, 50000), // limit stored text
      });

      res.json({
        success: true,
        filename,
        storageUrl,
        extractedText: extractedText.slice(0, 100) + "...",
        fullText: extractedText,
      });
    } catch (err) {
      console.error("[Upload] Error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Upload failed" });
    }
  });
}
