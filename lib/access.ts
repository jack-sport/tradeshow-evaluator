import type { EvaluationStatus, Role } from "./types";

/** Peer scores remain hidden until a member submits; administrators retain oversight. */
export function canViewPeerResults(status: EvaluationStatus | null, role: Role) {
  return role === "admin" || status === "submitted";
}
