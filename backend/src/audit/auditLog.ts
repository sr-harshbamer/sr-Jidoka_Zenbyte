import crypto from "crypto";
import { prisma } from "../db/client";

/**
 * Every audit event's hash covers its own payload plus the previous event's
 * hash, so the chain breaks (and is detectably broken) if any past record
 * is edited after the fact. Lightweight tamper-evidence — not a claim of
 * cryptographic, blockchain-grade security.
 */
export async function appendAuditEvent(params: {
  runId: string;
  eventType: string;
  actor: "agent" | "system" | "human";
  summary: string;
  payload: unknown;
}) {
  const last = await prisma.auditEvent.findFirst({
    where: { runId: params.runId },
    orderBy: { timestamp: "desc" },
  });

  const previousEventHash = last?.hash ?? null;
  const fullPayload = JSON.stringify(params.payload);
  const hash = crypto
    .createHash("sha256")
    .update(`${previousEventHash ?? ""}|${params.eventType}|${fullPayload}`)
    .digest("hex");

  return prisma.auditEvent.create({
    data: {
      runId: params.runId,
      eventType: params.eventType,
      actor: params.actor,
      summary: params.summary,
      fullPayload,
      previousEventHash,
      hash,
    },
  });
}
