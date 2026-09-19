import { EvidenceConflict, EvidenceItem } from "./types";

const CONFLICT_TOLERANCE_RATIO = 0.05; // >5% difference between trusted claims counts as a conflict

/**
 * Compares numeric claims from trusted evidence sources. If two trusted
 * sources disagree materially about the same fact (e.g. two different
 * prices for the same item), that's real uncertainty worth surfacing —
 * even though no explicit policy was broken.
 */
export function checkEvidenceConflicts(evidence: EvidenceItem[]): EvidenceConflict[] {
  const conflicts: EvidenceConflict[] = [];
  const trusted = evidence.filter(
    (e) => e.sourceType === "trusted" && typeof e.claimValue === "number"
  );

  for (let i = 0; i < trusted.length; i++) {
    for (let j = i + 1; j < trusted.length; j++) {
      const a = trusted[i];
      const b = trusted[j];
      if (a.claimLabel !== b.claimLabel) continue;

      const diff = Math.abs((a.claimValue as number) - (b.claimValue as number));
      const base = Math.max(Math.abs(a.claimValue as number), Math.abs(b.claimValue as number), 1);

      if (diff / base > CONFLICT_TOLERANCE_RATIO) {
        conflicts.push({
          a,
          b,
          reason: `"${a.source}" and "${b.source}" report different values for ${a.claimLabel} (${a.claimValue} vs ${b.claimValue}).`,
        });
      }
    }
  }

  return conflicts;
}
