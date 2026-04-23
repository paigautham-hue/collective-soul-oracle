import { useCollabPresence } from "@/hooks/useCollabPresence";

interface Props {
  projectId: number;
  userId: number | null;
  userName?: string | null;
  section?: string;
}

function colorFor(id: number): string {
  const hues = [280, 145, 75, 25, 200, 320, 100, 175];
  return `oklch(0.65 0.22 ${hues[id % hues.length]})`;
}

function initials(name?: string | null): string {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function PresenceAvatars({ projectId, userId, userName, section }: Props) {
  const { peers } = useCollabPresence({ projectId, userId, name: userName ?? null, section });

  if (peers.length === 0) return null;

  return (
    <div className="flex items-center gap-1" title={`${peers.length} other${peers.length === 1 ? "" : "s"} viewing`}>
      <div className="flex -space-x-2">
        {peers.slice(0, 5).map((p) => (
          <div
            key={p.userId}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2"
            style={{ background: colorFor(p.userId), borderColor: "oklch(0.06 0.02 265)", color: "white" }}
            title={`${p.name ?? "Anonymous"}${p.section ? ` · ${p.section}` : ""}`}
          >
            {initials(p.name)}
          </div>
        ))}
        {peers.length > 5 && (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2"
               style={{ background: "oklch(0.30 0.02 265)", borderColor: "oklch(0.06 0.02 265)", color: "oklch(0.85 0.02 265)" }}>
            +{peers.length - 5}
          </div>
        )}
      </div>
      <span className="ml-1.5 text-xs" style={{ color: "oklch(0.55 0.02 265)" }}>here too</span>
    </div>
  );
}
