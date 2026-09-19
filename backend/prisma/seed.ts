import { prisma } from "../src/db/client";
import { DEMO_POLICIES } from "../src/simulator/fixtures";

async function main() {
  const existingAgent = await prisma.agent.findFirst({ where: { type: "procurement" } });
  if (!existingAgent) {
    await prisma.agent.create({
      data: {
        name: "Procurement Agent",
        type: "procurement",
        description:
          "Handles purchase requests: searches vendors, compares prices, and executes approved purchases.",
      },
    });
    console.log("Seeded: Procurement Agent");
  }

  for (const policy of DEMO_POLICIES) {
    const existing = await prisma.policy.findFirst({ where: { name: policy.name } });
    if (existing) continue;
    await prisma.policy.create({
      data: {
        name: policy.name,
        description: policy.description,
        condition: JSON.stringify(policy.condition),
        severity: policy.severity,
        action: policy.action,
        enabled: policy.enabled,
      },
    });
    console.log(`Seeded policy: ${policy.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
