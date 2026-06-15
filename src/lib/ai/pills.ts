export interface Pill {
  id: string;
  label: string;
  /** Injected verbatim into the AI prompt as an instruction line. */
  instruction: string;
}

export const PILLS: Pill[] = [
  {
    id: "devils_advocate",
    label: "Devil's Advocate",
    instruction:
      "Challenge this idea rigorously. Identify the strongest objections, hidden assumptions, and scenarios where it fails. Be direct — don't soften criticism.",
  },
  {
    id: "market_fit",
    label: "Market Fit",
    instruction:
      "Assess product-market fit. Who specifically would use or pay for this? Is the target audience large enough? What evidence supports or undermines demand?",
  },
  {
    id: "technical_feasibility",
    label: "Technical Feasibility",
    instruction:
      "Evaluate technical feasibility. What are the hardest engineering challenges? Are there known blockers, dependencies, or integration risks?",
  },
  {
    id: "risk_assessment",
    label: "Risk Assessment",
    instruction:
      "Surface the top risks: technical, business, legal, operational, and reputational. For each risk, rate likelihood and impact (high/medium/low).",
  },
  {
    id: "user_impact",
    label: "User Impact",
    instruction:
      "Analyse the end-user impact. How does this change the user's workflow? What problems does it solve? What friction might it introduce?",
  },
  {
    id: "prioritization",
    label: "Prioritization",
    instruction:
      "Should this be built now, later, or not at all? Compare effort vs value. What would be lost by deferring 3 months? What would be lost by doing it now?",
  },
  {
    id: "competitive_landscape",
    label: "Competitive Landscape",
    instruction:
      "How does this compare to existing solutions? Who else has tried this? What did they get right and wrong? What would make this meaningfully differentiated?",
  },
  {
    id: "next_steps",
    label: "Next Steps",
    instruction:
      "Propose the 3–5 most important concrete next actions to validate or advance this idea. Be specific — avoid generic advice like 'do research'.",
  },
];

export const PILL_MAP = new Map(PILLS.map((p) => [p.id, p]));

export function resolvePills(ids: string[]): Pill[] {
  return ids.flatMap((id) => {
    const p = PILL_MAP.get(id);
    return p ? [p] : [];
  });
}
