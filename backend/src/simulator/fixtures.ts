import { PolicyDef } from "../engine/types";

export const APPROVED_VENDORS = ["Apex IT Supplies", "TechSource Distributors"];

export const DEMO_POLICIES: PolicyDef[] = [
  {
    id: "PROCUREMENT_01",
    name: "Budget Cap",
    description: "Never spend more than the run's stated budget.",
    condition: { type: "budget_limit", maxAmount: 800000 },
    severity: "HIGH",
    action: "BLOCK",
    enabled: true,
  },
  {
    id: "PROCUREMENT_02",
    name: "Approved Vendors Only",
    description: "Purchasing from a vendor outside the approved list needs a human sign-off — it may be a legitimate one-off, not an automatic no.",
    condition: { type: "approved_vendors", vendors: APPROVED_VENDORS },
    severity: "HIGH",
    action: "REQUIRE_APPROVAL",
    enabled: true,
  },
  {
    id: "PROCUREMENT_03",
    name: "Irreversible Actions Need Sign-off",
    description: "Any irreversible purchase execution requires human approval.",
    condition: { type: "irreversible_action", actions: ["execute_purchase"] },
    severity: "MEDIUM",
    action: "REQUIRE_APPROVAL",
    enabled: false, // off by default in the main demo scenario; enable for a variation
  },
];
