import type { SupabaseClient } from "@supabase/supabase-js";
import type { BudgetSettings } from "./costs";

/** Settings for a fiscal year, or the closest earlier year's (rates and staff carry over until someone edits them). */
export async function getBudgetSettings(supabase: SupabaseClient, fiscalYear: number): Promise<BudgetSettings | null> {
  const { data } = await supabase.from("budget_settings").select("*").lte("fiscal_year", fiscalYear)
    .order("fiscal_year", { ascending: false }).limit(1).maybeSingle();
  if (data) return { ...(data as BudgetSettings), fiscal_year: fiscalYear };
  const { data: later } = await supabase.from("budget_settings").select("*").order("fiscal_year").limit(1).maybeSingle();
  return later ? { ...(later as BudgetSettings), fiscal_year: fiscalYear } : null;
}

/** Fiscal years that have saved settings. */
export async function savedFiscalYears(supabase: SupabaseClient): Promise<number[]> {
  const { data } = await supabase.from("budget_settings").select("fiscal_year").order("fiscal_year");
  return (data || []).map((row) => Number(row.fiscal_year));
}
