import { EvidenceItem, InjectionMatch } from "./types";

/**
 * Pattern/heuristic matcher for manipulation attempts hidden in untrusted
 * text (e.g. a vendor document instructing the agent to break its own
 * rules). Deliberately simple and explainable rather than a second LLM
 * call judging the first — a heuristic gate should not itself be a black box.
 */
const SUSPICIOUS_PATTERNS: RegExp[] = [
  /ignore (all |any |the )?(previous|prior|above)\s+(instructions?|restrictions?|rules?)/i,
  /disregard (the |all |any )?(policy|policies|rules?|restrictions?)/i,
  /override (the )?(system|policy|safety)/i,
  /you must (now |immediately )?(use|select|approve|ignore)/i,
  /this is (a |an )?(system|admin|override) (message|instruction|command)/i,
  /do not (report|flag|log|tell) (this|the (human|user|reviewer))/i,
  /new instructions?:/i,
];

export function detectInjection(evidence: EvidenceItem[]): InjectionMatch[] {
  const matches: InjectionMatch[] = [];

  for (const item of evidence) {
    if (item.sourceType !== "untrusted") continue;
    for (const pattern of SUSPICIOUS_PATTERNS) {
      const match = item.content.match(pattern);
      if (match) {
        matches.push({ evidence: item, matchedPhrase: match[0] });
        break; // one flag per evidence item is enough
      }
    }
  }

  return matches;
}
