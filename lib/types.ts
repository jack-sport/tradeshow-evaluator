export type Role = "admin" | "member";
export type EvaluationStatus = "draft" | "submitted";
export type Recommendation = "exhibit" | "sales_only" | "skip";
export type CriterionSection = "opportunity" | "exhibit";

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
}

export interface Event {
  id: string;
  name: string;
  location: string | null;
  starts_on: string | null;
  ends_on: string | null;
  event_tier: "major" | "regional" | "other";
  status: "active" | "archived";
  exhibit_cost: number;
  sales_only_cost: number;
  high_value_targets: number;
  notes: string | null;
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
  submitted_at: string | null;
  updated_at: string;
}

export interface ResponseRow {
  criterion_id: string;
  rating: number;
  comment: string | null;
}

export interface PeerEvaluation extends Evaluation {
  profiles: { full_name: string } | null;
  evaluation_responses: Array<{ criterion_id: string; rating: number }>;
}
