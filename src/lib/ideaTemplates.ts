export interface IdeaTemplate {
  id: string;
  label: string;
  description: string;
  suggestedPillIds: string[];
}

export const IDEA_TEMPLATES: IdeaTemplate[] = [
  {
    id: "product_feature",
    label: "Product Feature",
    description: `## Problem
What user pain point or gap does this address?

## Proposed Solution
Describe the feature. How does it work?

## Target Users
Who benefits from this, and how often?

## Success Metrics
How will we know it worked? (e.g. adoption rate, time saved, support ticket reduction)

## Open Questions / Risks
What do we need to validate before building?`,
    suggestedPillIds: ["market_fit", "user_impact", "technical_feasibility", "prioritization"],
  },
  {
    id: "process_improvement",
    label: "Process Improvement",
    description: `## Current State
Describe the current process and what's broken or slow.

## Proposed Change
What specifically would change?

## Expected Benefits
What do we gain? (time saved, error reduction, cost, morale)

## Implementation Effort
Who needs to be involved? What systems or workflows are affected?

## Open Questions / Risks
What could go wrong? What dependencies exist?`,
    suggestedPillIds: ["user_impact", "risk_assessment", "prioritization"],
  },
  {
    id: "new_market_opportunity",
    label: "New Market Opportunity",
    description: `## Market Opportunity
Describe the market gap or emerging trend.

## Our Angle
Why are we well-positioned to capture this?

## Target Segment
Who is the primary buyer/user? How large is the addressable market?

## Revenue Model
How would this generate value or revenue?

## Go-To-Market
How would we reach and acquire customers?

## Open Questions / Risks
What must be true for this to work?`,
    suggestedPillIds: ["market_fit", "competitive_landscape", "risk_assessment", "devils_advocate"],
  },
  {
    id: "technical_debt",
    label: "Technical Debt",
    description: `## Problem Area
What codebase, infrastructure, or architecture issue are we addressing?

## Current Impact
How is this hurting us today? (velocity, reliability, security, cost)

## Proposed Fix
What would we change or replace?

## Risk of Not Fixing
What happens if we defer this 6 months? 12 months?

## Effort Estimate
Rough size: days / weeks / months. Who needs to be involved?`,
    suggestedPillIds: ["risk_assessment", "prioritization", "technical_feasibility"],
  },
];

export const IDEA_TEMPLATE_MAP = new Map(IDEA_TEMPLATES.map((t) => [t.id, t]));
