// Real-time collab presence — Phase 2.11.
// Each editor in a project broadcasts { userId, name, section } and receives
// the same from peers. Stale entries (no event in 30s) are evicted.

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

export interface PresencePeer {
  userId: number;
  name?: string | null;
  section?: string;
  lastSeenAt: number;
}

let _sock: Socket | null = null;
function getSocket(): Socket {
  if (!_sock) _sock = io({ path: "/api/socket.io" });
  return _sock;
}

export function useCollabPresence(args: {
  projectId: number | null;
  userId: number | null;
  name?: string | null;
  section?: string;
}): { peers: PresencePeer[] } {
  const { projectId, userId, name, section } = args;
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!projectId || !userId) return;
    const sock = getSocket();
    sock.emit("join:project", projectId);

    const broadcast = () => sock.emit("collab:presence", { projectId, userId, name, section });
    broadcast();
    heartbeatRef.current = setInterval(broadcast, 8000);

    const onPresence = (p: { userId: number; name?: string | null; section?: string }) => {
      if (p.userId === userId) return;
      setPeers((prev) => {
        const now = Date.now();
        const next = prev.filter((x) => x.userId !== p.userId && now - x.lastSeenAt < 30000);
        next.push({ ...p, lastSeenAt: now });
        return next;
      });
    };

    const evictTimer = setInterval(() => {
      const now = Date.now();
      setPeers((prev) => prev.filter((x) => now - x.lastSeenAt < 30000));
    }, 5000);

    sock.on("collab:presence", onPresence);

    return () => {
      sock.emit("leave:project", projectId);
      sock.off("collab:presence", onPresence);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      clearInterval(evictTimer);
    };
  }, [projectId, userId, name, section]);

  return { peers };
}
