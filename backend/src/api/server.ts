import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "../db/client";
import { startScenarioRun, resolveApproval, GateEmitter } from "../simulator/procurementAgent";
import { SCENARIO_SCRIPTS } from "../simulator/scripts";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, { cors: { origin: "*" } });

  const emit: GateEmitter = (event) => {
    io.emit("gate_event", event);
  };

  io.on("connection", (socket) => {
    console.log(`client connected: ${socket.id}`);
    socket.on("disconnect", () => console.log(`client disconnected: ${socket.id}`));
  });

  // --- Scenarios ---
  app.get("/api/scenarios", (_req, res) => {
    res.json(
      Object.values(SCENARIO_SCRIPTS).map((s) => ({ key: s.key, title: s.title, task: s.task }))
    );
  });

  app.post("/api/runs/start", async (req, res) => {
    try {
      const { scenarioKey } = req.body as { scenarioKey: string };
      const result = await startScenarioRun(scenarioKey, emit);
      res.json({ runId: result.run.id, awaitingInterventionId: result.awaitingInterventionId ?? null });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/runs", async (_req, res) => {
    const runs = await prisma.agentRun.findMany({
      orderBy: { startedAt: "desc" },
      include: { agent: true },
      take: 50,
    });
    res.json(runs);
  });

  app.get("/api/runs/:id", async (req, res) => {
    const run = await prisma.agentRun.findUnique({
      where: { id: req.params.id },
      include: {
        steps: {
          orderBy: { stepNumber: "asc" },
          include: { evidence: true, decisions: true, riskEvents: true },
        },
        interventions: true,
        auditEvents: { orderBy: { timestamp: "asc" } },
      },
    });
    if (!run) return res.status(404).json({ error: "Run not found" });
    res.json(run);
  });

  // --- Approvals ---
  app.get("/api/interventions/pending", async (_req, res) => {
    const pending = await prisma.humanIntervention.findMany({
      where: { decision: "PENDING" },
      include: { run: true },
      orderBy: { requestedAt: "desc" },
    });
    res.json(pending);
  });

  app.post("/api/interventions/:id/resolve", async (req, res) => {
    try {
      const { decision, respondedBy } = req.body as { decision: string; respondedBy: string };
      await resolveApproval(req.params.id, decision as any, respondedBy ?? "unknown", emit);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Policies ---
  app.get("/api/policies", async (_req, res) => {
    res.json(await prisma.policy.findMany());
  });

  // --- Agent Health (pure aggregation over real stored events) ---
  app.get("/api/agents/:id/health", async (req, res) => {
    const agentId = req.params.id;
    const runs = await prisma.agentRun.findMany({ where: { agentId }, include: { steps: true } });
    const allSteps = runs.flatMap((r) => r.steps);
    const totalSteps = allSteps.length;
    const blockedSteps = allSteps.filter((s) => s.status === "BLOCK").length;
    const compliantSteps = allSteps.filter((s) => s.status === "ALLOW").length;
    const interventionCount = await prisma.humanIntervention.count({
      where: { run: { agentId } },
    });
    const avgRisk =
      totalSteps > 0 ? allSteps.reduce((sum, s) => sum + s.riskScore, 0) / totalSteps : 0;
    const toolUsage: Record<string, number> = {};
    for (const s of allSteps) {
      if (!s.tool) continue;
      toolUsage[s.tool] = (toolUsage[s.tool] ?? 0) + 1;
    }

    res.json({
      agentId,
      totalRuns: runs.length,
      totalSteps,
      policyComplianceRate: totalSteps > 0 ? compliantSteps / totalSteps : 1,
      blockedSteps,
      humanInterventions: interventionCount,
      averageRiskScore: Math.round(avgRisk * 10) / 10,
      toolUsage,
    });
  });

  // --- Audit ---
  app.get("/api/audit/:runId", async (req, res) => {
    const events = await prisma.auditEvent.findMany({
      where: { runId: req.params.runId },
      orderBy: { timestamp: "asc" },
    });
    res.json(events);
  });

  return { app, httpServer, io };
}
