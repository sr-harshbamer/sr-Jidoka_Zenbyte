import { evaluateStep } from "../gate/actionGate";
import { DEMO_POLICIES } from "./fixtures";
import { SCENARIOS } from "./scenarios";

let failures = 0;

console.log("Running the 5 Jidoka scenarios through the real action gate...\n");

for (const scenario of SCENARIOS) {
  const verdict = evaluateStep(scenario.step, DEMO_POLICIES);
  const pass = verdict.status === scenario.expectedStatus;
  if (!pass) failures++;

  console.log(`${pass ? "PASS" : "FAIL"}  [${scenario.key}] ${scenario.title}`);
  console.log(`   expected: ${scenario.expectedStatus}  got: ${verdict.status}  risk: ${verdict.riskScore}`);
  console.log(`   why: ${verdict.explanation}`);
  if (verdict.riskFactors.length > 0) {
    console.log(
      `   factors: ${verdict.riskFactors.map((f) => `${f.name}(+${f.points})`).join(", ")}`
    );
  }
  console.log("");
}

if (failures > 0) {
  console.error(`${failures} scenario(s) did not match their expected outcome.`);
  process.exit(1);
} else {
  console.log("All 5 scenarios produced their expected outcome.");
}
