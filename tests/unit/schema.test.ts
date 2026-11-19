import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("database scoring seed", () => {
  const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20261119000000_initial_schema.sql"), "utf8");
  it("seeds both scoring sections", () => {
    expect(sql.match(/\n\('opportunity'/g)?.length).toBe(15);
    expect(sql.match(/\n\('exhibit'/g)?.length).toBe(7);
  });
  it("includes database constraints and row-level security", () => {
    expect(sql).toContain("rating between 1 and 5");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("users manage own responses");
  });
});
