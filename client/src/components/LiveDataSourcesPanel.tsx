import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Newspaper,
  BookOpen,
  TrendingUp,
  Users,
  Globe,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Key,
  Sparkles,
  Star,
} from "lucide-react";

interface DataSourceMeta {
  id: string;
  name: string;
  description: string;
  category: "news" | "academic" | "finance" | "social" | "government";
  requiresKey: boolean;
  keyEnvVar?: string;
  keyUrl?: string;
  free: boolean;
  tags: string[];
}

interface Recommendation {
  sourceId: string;
  relevanceScore: number;
  reason: string;
  suggestedQuery: string;
}

interface IngestionState {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
  itemCount?: number;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  news: <Newspaper className="w-4 h-4" />,
  academic: <BookOpen className="w-4 h-4" />,
  finance: <TrendingUp className="w-4 h-4" />,
  social: <Users className="w-4 h-4" />,
  government: <Globe className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  news: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  academic: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  finance: "bg-green-500/20 text-green-300 border-green-500/30",
  social: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  government: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
};

interface Props {
  projectId: number;
  topic: string;
  projectType?: "narrative" | "technical" | "finance";
  description?: string;
  onIngested?: (fileName: string) => void;
}

export function LiveDataSourcesPanel({ projectId, topic, projectType, description, onIngested }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("recommended");
  const [queries, setQueries] = useState<Record<string, string>>({});
  const [ingestionState, setIngestionState] = useState<Record<string, IngestionState>>({});
  const [extraOptions, setExtraOptions] = useState<Record<string, string>>({});
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationsLoaded, setRecommendationsLoaded] = useState(false);

  const { data: sources = [], isLoading: sourcesLoading } = trpc.datasources.list.useQuery();

  const recommendMutation = trpc.datasources.recommend.useMutation({
    onSuccess: (recs) => {
      setRecommendations(recs);
      setRecommendationsLoaded(true);
      // Auto-fill suggested queries
      const autoQueries: Record<string, string> = {};
      for (const rec of recs) {
        if (rec.suggestedQuery) autoQueries[rec.sourceId] = rec.suggestedQuery;
      }
      setQueries((prev) => ({ ...autoQueries, ...prev }));
    },
    onError: () => {
      toast.error("Could not load recommendations — showing all sources");
      setRecommendationsLoaded(true);
    },
  });

  const ingestMutation = trpc.datasources.ingest.useMutation({
    onSuccess: (data, variables) => {
      setIngestionState((prev) => ({
        ...prev,
        [variables.sourceId]: { status: "success", itemCount: data.itemCount, message: `${data.itemCount} items ingested` },
      }));
      toast.success(`Ingested ${data.itemCount} items from ${variables.sourceId}`);
      if (onIngested) onIngested(data.fileName);
    },
    onError: (err, variables) => {
      setIngestionState((prev) => ({
        ...prev,
        [variables.sourceId]: { status: "error", message: err.message },
      }));
      toast.error(`Failed to ingest from ${variables.sourceId}: ${err.message}`);
    },
  });

  // Auto-load recommendations when panel is first expanded
  useEffect(() => {
    if (expanded && !recommendationsLoaded && !recommendMutation.isPending && topic) {
      recommendMutation.mutate({ topic, projectType, description });
    }
  }, [expanded, recommendationsLoaded, topic, projectType, description]);

  const recMap = useMemo(() => {
    const m: Record<string, Recommendation> = {};
    for (const r of recommendations) m[r.sourceId] = r;
    return m;
  }, [recommendations]);

  const categories = useMemo(() => {
    const cats = new Set((sources as DataSourceMeta[]).map((s) => s.category));
    return ["recommended", "all", ...Array.from(cats)];
  }, [sources]);

  const filteredSources = useMemo(() => {
    let list = sources as DataSourceMeta[];
    if (activeCategory !== "all" && activeCategory !== "recommended") {
      list = list.filter((s) => s.category === activeCategory);
    }
    if (activeCategory === "recommended" && recommendations.length > 0) {
      // Sort by relevance score descending, only show score >= 40
      const scored = list
        .map((s) => ({ source: s, score: recMap[s.id]?.relevanceScore ?? 0 }))
        .filter((x) => x.score >= 40)
        .sort((a, b) => b.score - a.score);
      return scored.map((x) => x.source);
    }
    if (recommendations.length > 0) {
      // Sort all by relevance score descending
      return [...list].sort((a, b) => (recMap[b.id]?.relevanceScore ?? 0) - (recMap[a.id]?.relevanceScore ?? 0));
    }
    return list;
  }, [sources, activeCategory, recommendations, recMap]);

  const handleIngest = (source: DataSourceMeta) => {
    const query = queries[source.id] || topic;
    if (!query.trim()) {
      toast.error("Enter a search query first");
      return;
    }
    setIngestionState((prev) => ({ ...prev, [source.id]: { status: "loading" } }));
    const options: Record<string, string> = {};
    if (extraOptions[`${source.id}_symbol`]) options.symbol = extraOptions[`${source.id}_symbol`];
    if (extraOptions[`${source.id}_subreddit`]) options.subreddit = extraOptions[`${source.id}_subreddit`];
    if (extraOptions[`${source.id}_country`]) options.countryCode = extraOptions[`${source.id}_country`];
    ingestMutation.mutate({
      projectId,
      sourceId: source.id,
      query,
      options: Object.keys(options).length > 0 ? options : undefined,
    });
  };

  const getRelevanceBadge = (sourceId: string) => {
    const rec = recMap[sourceId];
    if (!rec) return null;
    if (rec.relevanceScore >= 80) {
      return (
        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
          <Star className="w-2.5 h-2.5 fill-amber-300" />
          Top Pick
        </span>
      );
    }
    if (rec.relevanceScore >= 60) {
      return (
        <span className="flex items-center gap-0.5 text-[10px] font-medium text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.5 rounded-full">
          <Sparkles className="w-2.5 h-2.5" />
          Recommended
        </span>
      );
    }
    return null;
  };

  if (sourcesLoading) {
    return (
      <div className="flex items-center gap-2 text-white/40 text-sm py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading data sources...
      </div>
    );
  }

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.02] mt-4">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-white/80">Live Data Sources</span>
          <Badge variant="outline" className="text-xs border-indigo-500/30 text-indigo-300 bg-indigo-500/10">
            {sources.length} sources
          </Badge>
          {recommendationsLoaded && recommendations.length > 0 && (
            <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-300 bg-amber-500/10 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              AI-ranked for your topic
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <span className="hidden sm:block">Fetch real-time data to ground your simulation</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Recommendation loading state */}
          {recommendMutation.isPending && (
            <div className="flex items-center gap-2 text-indigo-300 text-sm py-2 px-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>AI is analysing your topic and ranking the best data sources…</span>
            </div>
          )}

          {/* Category filter */}
          <div className="flex flex-wrap gap-2 pt-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  activeCategory === cat
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                }`}
              >
                {cat === "all" ? "All" : cat === "recommended" ? "✦ Recommended" : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          {activeCategory === "recommended" && recommendationsLoaded && filteredSources.length === 0 && (
            <p className="text-sm text-white/40 text-center py-4">
              No highly-relevant sources found for this topic. Switch to "All" to see everything.
            </p>
          )}

          {/* Source cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredSources.map((source) => {
              const state = ingestionState[source.id] || { status: "idle" };
              const rec = recMap[source.id];
              return (
                <div
                  key={source.id}
                  className={`rounded-lg border p-3 space-y-2 transition-all ${
                    state.status === "success"
                      ? "border-green-500/30 bg-green-500/5"
                      : state.status === "error"
                      ? "border-red-500/30 bg-red-500/5"
                      : rec && rec.relevanceScore >= 80
                      ? "border-amber-500/25 bg-amber-500/5 hover:border-amber-500/40"
                      : rec && rec.relevanceScore >= 60
                      ? "border-indigo-500/25 bg-indigo-500/5 hover:border-indigo-500/40"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20"
                  }`}
                >
                  {/* Source header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`p-1 rounded-md border shrink-0 ${CATEGORY_COLORS[source.category]}`}>
                        {CATEGORY_ICONS[source.category]}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white/90 truncate">{source.name}</div>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          {source.free && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-green-500/30 text-green-400 bg-green-500/10">
                              Free
                            </Badge>
                          )}
                          {source.requiresKey && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-yellow-500/30 text-yellow-400 bg-yellow-500/10 flex items-center gap-0.5">
                              <Key className="w-2.5 h-2.5" />
                              API Key
                            </Badge>
                          )}
                          {getRelevanceBadge(source.id)}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {state.status === "success" && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                      {state.status === "error" && <AlertCircle className="w-4 h-4 text-red-400" />}
                      {rec && (
                        <span className={`text-[10px] font-mono font-bold ${
                          rec.relevanceScore >= 80 ? "text-amber-400" :
                          rec.relevanceScore >= 60 ? "text-indigo-400" :
                          "text-white/30"
                        }`}>
                          {rec.relevanceScore}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* AI reason */}
                  {rec && rec.reason && (
                    <p className="text-[11px] text-indigo-300/70 italic leading-relaxed border-l-2 border-indigo-500/30 pl-2">
                      {rec.reason}
                    </p>
                  )}

                  {/* Description (shown when no AI reason) */}
                  {!rec && (
                    <p className="text-xs text-white/40 leading-relaxed">{source.description}</p>
                  )}

                  {/* Query input */}
                  <Input
                    value={queries[source.id] ?? topic}
                    onChange={(e) => setQueries((prev) => ({ ...prev, [source.id]: e.target.value }))}
                    placeholder="Search query…"
                    className="h-7 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />

                  {/* Extra options for specific sources */}
                  {source.id === "reddit" && (
                    <Input
                      value={extraOptions[`${source.id}_subreddit`] ?? ""}
                      onChange={(e) => setExtraOptions((prev) => ({ ...prev, [`${source.id}_subreddit`]: e.target.value }))}
                      placeholder="Subreddit (optional, e.g. worldnews)"
                      className="h-7 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  )}
                  {(source.id === "finnhub" || source.id === "alphavantage") && (
                    <Input
                      value={extraOptions[`${source.id}_symbol`] ?? ""}
                      onChange={(e) => setExtraOptions((prev) => ({ ...prev, [`${source.id}_symbol`]: e.target.value }))}
                      placeholder="Ticker symbol (optional, e.g. AAPL)"
                      className="h-7 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  )}
                  {source.id === "worldbank" && (
                    <Input
                      value={extraOptions[`${source.id}_country`] ?? ""}
                      onChange={(e) => setExtraOptions((prev) => ({ ...prev, [`${source.id}_country`]: e.target.value }))}
                      placeholder="Country code (optional, e.g. US)"
                      className="h-7 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  )}

                  {/* Status message */}
                  {state.message && (
                    <p className={`text-[10px] ${state.status === "success" ? "text-green-400" : "text-red-400"}`}>
                      {state.message}
                    </p>
                  )}

                  {/* Ingest button */}
                  <Button
                    size="sm"
                    onClick={() => handleIngest(source)}
                    disabled={state.status === "loading" || state.status === "success"}
                    className={`w-full h-7 text-xs gap-1.5 ${
                      state.status === "success"
                        ? "bg-green-600/30 text-green-300 border border-green-500/30 cursor-default"
                        : rec && rec.relevanceScore >= 80
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    }`}
                  >
                    {state.status === "loading" ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Fetching…</>
                    ) : state.status === "success" ? (
                      <><CheckCircle2 className="w-3 h-3" /> Ingested</>
                    ) : (
                      <><Download className="w-3 h-3" /> Ingest</>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-white/30 text-center">
            Ingested data is saved as a project document and included in your knowledge graph and research context.
          </p>
        </div>
      )}
    </div>
  );
}
