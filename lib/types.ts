export type Role = "admin" | "member";
export type EvaluationStatus = "draft" | "submitted";
export type Recommendation = "exhibit" | "sales_only" | "skip";
export type CriterionSection = "opportunity" | "exhibit";
export type Participation = "exhibited" | "attended" | "did_not_attend" | "unknown";

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  is_ai?: boolean;
}

export interface Event {
  id: string;
  name: string;
  location: string | null;
  starts_on: string | null;
  ends_on: string | null;
  event_tier: "major" | "regional" | "other";
  status: "active" | "archived";
  exhibit_cost: number | null;
  sales_only_cost: number | null;
  high_value_targets: number | null;
  /** Line items behind exhibit_cost and sales_only_cost (dollars by item key). */
  exhibit_cost_breakdown?: Record<string, number>;
  sales_cost_breakdown?: Record<string, number>;
  /** Cost and staffing inputs (see lib/costs.ts). */
  region?: import("./costs").Region | null;
  exhibit_kind?: import("./costs").ExhibitKind | null;
  sales_people?: number | null;
  marketing_traveler?: boolean | null;
  cost_items?: Partial<Record<import("./costs").CostItemKey, import("./costs").CostItem>> | null;
  included_registrations?: number | null;
  package_includes?: string | null;
  /** Pre-show goals, compared with post-show meetings and contacts. */
  meeting_goal?: number | null;
  contact_goal?: number | null;
  notes: string | null;
  source_id?: string | null;
  web_address?: string | null;
  participation?: Participation;
  participation_notes?: string | null;
  tier_provisional?: boolean;
}

export interface Criterion {
  id: string;
  section: CriterionSection;
  category: string;
  label: string;
  description: string;
  weight: number;
  sort_order: number;
}

export interface Evaluation {
  id: string;
  event_id: string;
  evaluator_id: string;
  status: EvaluationStatus;
  recommendation: Recommendation | null;
  comments: string | null;
  opportunity_score: number | null;
  exhibit_score: number | null;
  opportunity_coverage?: number | null;
  exhibit_coverage?: number | null;
  submitted_at: string | null;
  updated_at: string;
}

export interface ResponseRow {
  criterion_id: string;
  /** null = Unknown */
  rating: number | null;
  comment: string | null;
}

export interface PeerEvaluation extends Evaluation {
  profiles: { full_name: string } | null;
  evaluation_responses: Array<{ criterion_id: string; rating: number | null }>;
}

export interface EventResults {
  id?: string;
  event_id: string;
  participation: Participation | null;
  staff_count: number | null;
  show_hours: number | null;
  contacts: number | null;
  meetings: number | null;
  qualified_leads: number | null;
  opportunities: number | null;
  actual_cost: number | null;
  /** Potential revenue value of the leads, for hard-dollar ROI. */
  lead_revenue_value?: number | null;
  cost_breakdown?: Record<string, number>;
  notes: string | null;
  updated_at?: string;
}
