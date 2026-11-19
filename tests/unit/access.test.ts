import { describe, expect, it } from "vitest";
import { canViewPeerResults } from "@/lib/access";

describe("peer-result privacy", () => {
  it("blocks a member before submission", () => expect(canViewPeerResults(null, "member")).toBe(false));
  it("blocks a member with a draft", () => expect(canViewPeerResults("draft", "member")).toBe(false));
  it("unlocks after submission", () => expect(canViewPeerResults("submitted", "member")).toBe(true));
  it("allows administrator oversight", () => expect(canViewPeerResults(null, "admin")).toBe(true));
});
