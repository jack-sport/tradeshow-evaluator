// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Comparison } from "@/components/comparison";
import { EvaluationForm } from "@/components/evaluation-form";
import type { Criterion, Evaluation, PeerEvaluation, ResponseRow } from "@/lib/types";

const criteria: Criterion[] = [
  { id: "a", section: "opportunity", category: "BD", label: "Target accounts", description: "Priority accounts", weight: 100, sort_order: 1 },
  { id: "b", section: "exhibit", category: "Value", label: "Booth traffic", description: "Qualified traffic", weight: 100, sort_order: 2 },
];
const evaluation: Evaluation = { id: "e", event_id: "show", evaluator_id: "user", status: "draft", recommendation: null, comments: null, opportunity_score: 60, exhibit_score: 40, submitted_at: null, updated_at: "2026-01-01" };
const responses: ResponseRow[] = [{ criterion_id: "a", rating: 3, comment: null }];

afterEach(cleanup);

function peer(id: string, name: string, score: number, recommendation: PeerEvaluation["recommendation"]): PeerEvaluation {
  return { ...evaluation, id, evaluator_id: id, status: "submitted", recommendation, opportunity_score: score, exhibit_score: score - 10, submitted_at: "2026-01-01", profiles: { full_name: name }, evaluation_responses: [{ criterion_id: "a", rating: 4 }, { criterion_id: "b", rating: 3 }] };
}

describe("evaluation form", () => {
  it("renders both scores, all rating controls, and independent save/submit actions", async () => {
    const user = userEvent.setup();
    const { container } = render(<EvaluationForm eventId="show" criteria={criteria} evaluation={evaluation} responses={responses} />);
    expect(screen.getByRole("heading", { name: "Event Opportunity" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Exhibit Value" })).toBeTruthy();
    // 2 criteria x (5 ratings + Unknown) + 3 recommendations
    expect(screen.getAllByRole("radio")).toHaveLength(15);
    expect(screen.getAllByRole("radio", { name: /Unknown/ })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Save draft" }).hasAttribute("formnovalidate")).toBe(true);
    const exceptional = container.querySelector("input[name='rating_b'][value='5']") as HTMLInputElement;
    await user.click(exceptional);
    expect(exceptional.checked).toBe(true);
  });
});

describe("comparison", () => {
  it("shows named evaluators, averages, recommendation counts and criterion differences", () => {
    render(<Comparison evaluations={[peer("1", "Jordan Lee", 90, "exhibit"), peer("2", "Morgan Patel", 70, "sales_only")]} criteria={criteria} />);
    expect(screen.getByText("Jordan Lee")).toBeTruthy();
    expect(screen.getByText("Morgan Patel")).toBeTruthy();
    expect(screen.getAllByText("80.0").length).toBeGreaterThan(0);
    expect(screen.getByText("Where the team stands")).toBeTruthy();
  });
});

describe("cost notes on the assessment form", () => {
  const costCriteria: Criterion[] = [
    { id: "o", section: "opportunity", category: "Economics", label: "Cost and staff efficiency", description: "Attending cost", weight: 100, sort_order: 1 },
    { id: "x", section: "exhibit", category: "Economics", label: "Exhibit cost efficiency", description: "Exhibit cost", weight: 100, sort_order: 2 },
  ];
  it("shows attending and exhibiting estimates, with line items and the extra cost of a booth", () => {
    render(<EvaluationForm eventId="show" criteria={costCriteria} evaluation={null} responses={[]}
      costs={{ exhibit: 23164, salesOnly: 8200, salesBreakdown: { registration: 1250, travel_lodging: 6950, staff_time: 0 }, exhibitBreakdown: { booth_sponsorship: 7750 } }} />);
    expect(screen.getByText("Estimated cost of attending (sales only): $8,200")).toBeTruthy();
    expect(screen.getByText("Registration $1,250 · Travel / lodging $6,950")).toBeTruthy();
    expect(screen.getByText("Estimated cost of exhibiting: $23,164 ($14,964 more than attending)")).toBeTruthy();
  });
  it("says when costs haven't been estimated", () => {
    render(<EvaluationForm eventId="show" criteria={costCriteria} evaluation={null} responses={[]} costs={{ exhibit: null, salesOnly: null }} />);
    expect(screen.getByText(/Cost of attending not estimated yet/)).toBeTruthy();
    expect(screen.getByText(/Cost of exhibiting not estimated yet/)).toBeTruthy();
  });
});
