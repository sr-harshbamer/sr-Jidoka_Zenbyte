# Jidoka

A runtime safety layer for autonomous AI agents. Watches an agent's actions step by step,
checks each one against policy, risk, evidence, and behavior signals, and pauses for human
approval before anything risky reaches the real world.

Built for HackIndore 4.0 — Agentic AI track (PS2: Reliability, Monitoring & Auditability for
Autonomous AI Systems).

## Structure

- `backend/` — Node.js + TypeScript backend: policy/risk/anomaly engines, the procurement
  agent simulator, and the real-time API.
- `mobile/` — Expo + React Native mobile app.

Setup instructions will be added as each part comes online.
