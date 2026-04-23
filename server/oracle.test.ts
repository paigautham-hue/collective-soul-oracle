import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getAllUsers: vi.fn().mockResolvedValue([
    { id: 1, openId: "user-1", name: "Alice", email: "alice@test.com", role: "user", loginMethod: "manus", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    { id: 2, openId: "admin-1", name: "Bob", email: "bob@test.com", role: "admin", loginMethod: "manus", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  ]),
  createProject: vi.fn().mockResolvedValue({ id: 1, title: "Test Project", userId: 1, status: "pending", createdAt: new Date(), updatedAt: new Date() }),
  getProjectsByUser: vi.fn().mockResolvedValue([
    { id: 1, title: "Test Project", userId: 1, status: "pending", topic: "AI", createdAt: new Date(), updatedAt: new Date() }
  ]),
  getProjectById: vi.fn().mockResolvedValue({ id: 1, title: "Test Project", userId: 1, status: "pending", topic: "AI", createdAt: new Date(), updatedAt: new Date() }),
  updateProject: vi.fn().mockResolvedValue(undefined),
  deleteProject: vi.fn().mockResolvedValue(undefined),
  getDocumentsByProject: vi.fn().mockResolvedValue([]),
  getGraphByProject: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
  clearGraphForProject: vi.fn().mockResolvedValue(undefined),
  upsertGraphNodes: vi.fn().mockResolvedValue(undefined),
  upsertGraphEdges: vi.fn().mockResolvedValue(undefined),
  getAgentsByProject: vi.fn().mockResolvedValue([
    { id: 1, projectId: 1, name: "Agent Alpha", ideology: "progressive", platform: "twitter", persona: "A tech enthusiast", createdAt: new Date() }
  ]),
  upsertAgents: vi.fn().mockResolvedValue(undefined),
  createSimulationRun: vi.fn().mockResolvedValue({ id: 1, projectId: 1, status: "pending", totalRounds: 5, platform: "both", createdAt: new Date() }),
  getSimulationRunsByProject: vi.fn().mockResolvedValue([
    { id: 1, projectId: 1, status: "completed", totalRounds: 5, currentRound: 5, platform: "both", createdAt: new Date() }
  ]),
  getSimulationRunById: vi.fn().mockResolvedValue({ id: 1, projectId: 1, status: "completed", totalRounds: 5, currentRound: 5, platform: "both", createdAt: new Date() }),
  updateSimulationRun: vi.fn().mockResolvedValue(undefined),
  getSimulationLogs: vi.fn().mockResolvedValue([
    { id: 1, simulationRunId: 1, agentName: "Agent Alpha", actionType: "post", content: "Hello world", platform: "twitter", round: 1, createdAt: new Date() }
  ]),
  addSimulationLog: vi.fn().mockResolvedValue(undefined),
  createReport: vi.fn().mockResolvedValue({ id: 1, projectId: 1, title: "Test Report", status: "generating", createdAt: new Date() }),
  getReportsByProject: vi.fn().mockResolvedValue([
    { id: 1, projectId: 1, title: "Test Report", status: "completed", content: "# Report\nContent here.", createdAt: new Date() }
  ]),
  getReportById: vi.fn().mockResolvedValue({ id: 1, projectId: 1, title: "Test Report", status: "completed", content: "# Report", createdAt: new Date() }),
  updateReport: vi.fn().mockResolvedValue(undefined),
  addChatMessage: vi.fn().mockResolvedValue(undefined),
  getChatMessages: vi.fn().mockResolvedValue([]),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Mocked LLM response for testing." } }]
  }),
}));

vi.mock("./llm-router", () => ({
  complete: vi.fn().mockResolvedValue({
    text: "Mocked LLM response for testing.",
    json: undefined,
    provider: "forge",
    model: "mock",
  }),
  completeText: vi.fn().mockResolvedValue("Mocked LLM response for testing."),
  completeJson: vi.fn().mockResolvedValue({}),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// ─── Context factories ────────────────────────────────────────────────────────
function makeUserCtx(overrides?: Partial<TrpcContext["user"]>): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "user-1",
      name: "Alice",
      email: "alice@test.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makeAdminCtx(): TrpcContext {
  return makeUserCtx({ role: "admin", openId: "admin-1", name: "Bob" });
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("auth", () => {
  it("me returns the current user", async () => {
    const ctx = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user?.name).toBe("Alice");
    expect(user?.role).toBe("user");
  });

  it("logout clears cookie and returns success", async () => {
    const ctx = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});

describe("projects", () => {
  it("list returns projects for the current user", async () => {
    const ctx = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    const projects = await caller.projects.list();
    expect(Array.isArray(projects)).toBe(true);
    expect(projects[0]?.title).toBe("Test Project");
  });

  it("get returns a single project by id", async () => {
    const ctx = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    const project = await caller.projects.get({ id: 1 });
    expect(project.id).toBe(1);
    expect(project.title).toBe("Test Project");
  });

  it("create returns the new project", async () => {
    const ctx = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    const project = await caller.projects.create({ title: "New Project", topic: "Climate" });
    expect(project).toBeDefined();
  });
});

describe("agents", () => {
  it("list returns agents for a project", async () => {
    const ctx = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    const agents = await caller.agents.list({ projectId: 1 });
    expect(Array.isArray(agents)).toBe(true);
    expect(agents[0]?.name).toBe("Agent Alpha");
  });

  it("chat returns a response from the LLM", async () => {
    const ctx = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.agents.chat({
      projectId: 1,
      message: "What do you think about AI?",
      history: [],
    });
    expect(result.response).toBe("Mocked LLM response for testing.");
    expect(result.agentName).toBe("Report Agent");
  });

  it("chat with specific agent uses agent persona", async () => {
    const ctx = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.agents.chat({
      projectId: 1,
      agentId: 1,
      message: "Tell me about yourself",
      history: [],
    });
    expect(result.response).toBeDefined();
    expect(result.agentName).toBe("Agent Alpha");
  });
});

describe("simulations", () => {
  it("list returns simulation runs for a project", async () => {
    const ctx = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    const runs = await caller.simulations.list({ projectId: 1 });
    expect(Array.isArray(runs)).toBe(true);
    expect(runs[0]?.status).toBe("completed");
  });

  it("get returns a simulation run by id", async () => {
    const ctx = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    const run = await caller.simulations.get({ id: 1 });
    expect(run.id).toBe(1);
    expect(run.totalRounds).toBe(5);
  });

  it("stop updates simulation status", async () => {
    const ctx = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.simulations.stop({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("logs returns simulation log entries", async () => {
    const ctx = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    const logs = await caller.simulations.logs({ simulationRunId: 1 });
    expect(Array.isArray(logs)).toBe(true);
    expect(logs[0]?.agentName).toBe("Agent Alpha");
  });
});

describe("reports", () => {
  it("list returns reports for a project", async () => {
    const ctx = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    const reports = await caller.reports.list({ projectId: 1 });
    expect(Array.isArray(reports)).toBe(true);
    expect(reports[0]?.title).toBe("Test Report");
  });

  it("get returns a report by id", async () => {
    const ctx = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    const report = await caller.reports.get({ id: 1 });
    expect(report.id).toBe(1);
    expect(report.status).toBe("completed");
  });
});

describe("admin", () => {
  it("users returns all users for admin", async () => {
    const ctx = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const users = await caller.admin.users();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBe(2);
  });

  it("users throws FORBIDDEN for non-admin", async () => {
    const ctx = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.users()).rejects.toThrow();
  });
});

describe("graph", () => {
  it("get returns graph data for a project", async () => {
    const ctx = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    const graph = await caller.graph.get({ projectId: 1 });
    expect(graph).toBeDefined();
    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(Array.isArray(graph.edges)).toBe(true);
  });
});
