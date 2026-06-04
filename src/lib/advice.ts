import type { AdvicePlan, CarbonReport, EmissionBreakdown } from "./types";

export const ACTIVE_ADVICE_STORAGE_KEY = "carbonlens_active_advice_plan";

interface DriverStats {
  category: string;
  total: number;
  percentage: number;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function categoryTotals(reports: CarbonReport[]): DriverStats[] {
  const totals = new Map<string, number>();
  let grandTotal = 0;

  for (const report of reports) {
    grandTotal += report.total_co2e_kg;
    for (const item of report.breakdown ?? []) {
      totals.set(item.category, (totals.get(item.category) ?? 0) + item.kg_co2e);
    }
  }

  return Array.from(totals.entries())
    .map(([category, total]) => ({
      category,
      total,
      percentage: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

function recentTrend(reports: CarbonReport[]): string {
  if (reports.length < 4) return "Not enough history yet; using the current footprint pattern.";
  const recent = reports.slice(0, Math.min(7, reports.length));
  const previous = reports.slice(recent.length, recent.length * 2);
  if (!previous.length) return "Recent records are being used as the current baseline.";

  const recentAvg = recent.reduce((sum, report) => sum + report.total_co2e_kg, 0) / recent.length;
  const previousAvg =
    previous.reduce((sum, report) => sum + report.total_co2e_kg, 0) / previous.length;
  const delta = recentAvg - previousAvg;
  const percent = previousAvg > 0 ? Math.abs(delta / previousAvg) * 100 : 0;

  if (Math.abs(delta) < 0.5) {
    return `Recent average is stable at ${round(recentAvg)} kg CO2e/day.`;
  }
  return delta > 0
    ? `Recent average rose ${round(percent)}% to ${round(recentAvg)} kg CO2e/day.`
    : `Recent average improved ${round(percent)}% to ${round(recentAvg)} kg CO2e/day.`;
}

function fallbackBreakdown(reports: CarbonReport[]): EmissionBreakdown[] {
  const total = reports.reduce((sum, report) => sum + report.total_co2e_kg, 0);
  if (total <= 0) return [];
  return categoryTotals(reports).map((driver) => ({
    category: driver.category,
    kg_co2e: round(driver.total, 2),
    percentage: round(driver.percentage, 1),
  }));
}

function planForCategory(driver: DriverStats, rank: number, trend: string): AdvicePlan {
  const baseReduction = Math.max(0.5, driver.total / 30 / 4);
  const evidence = `${driver.category} accounts for ${round(driver.percentage)}% of the last 30 days. ${trend}`;

  const templates: Record<string, Omit<AdvicePlan, "id" | "rank" | "primary_driver" | "evidence" | "estimated_reduction_kg">> = {
    Food: {
      title: "Replace one high-carbon meal pattern",
      summary: "Food is a major driver, so changing one repeated meal habit can reduce emissions without changing your whole lifestyle.",
      short_term_action: "Swap one beef or pork meal this week for chicken, tofu, or vegetables.",
      mid_term_action: "Set two lower-carbon meal days per week and keep the meals easy to repeat.",
      long_term_action: "Build a default low-carbon meal routine for weekdays.",
      difficulty: "easy",
    },
    Transport: {
      title: "Shift repeated car trips",
      summary: "Transport emissions often come from repeat routes, so one route change can compound over time.",
      short_term_action: "Replace one short car trip this week with transit, walking, biking, or carpooling.",
      mid_term_action: "Batch errands twice a week to avoid separate short trips.",
      long_term_action: "Rework your regular commute or route choices around a lower-carbon default.",
      difficulty: "medium",
    },
    Energy: {
      title: "Smooth home energy peaks",
      summary: "Energy use is visible in your recent footprint, so small comfort-setting changes can add up.",
      short_term_action: "Adjust AC or heating by 1-2 degrees today and shorten one hot-water use.",
      mid_term_action: "Air-dry laundry once per week and avoid running high-energy appliances together.",
      long_term_action: "Improve appliance habits and review insulation or device efficiency.",
      difficulty: "easy",
    },
    "Consumer Goods": {
      title: "Stretch product lifetimes",
      summary: "New goods carry manufacturing emissions, so delaying or replacing purchases has a durable benefit.",
      short_term_action: "Delay one non-essential purchase this week or look for a second-hand option.",
      mid_term_action: "Repair, reuse, or borrow one item instead of buying new.",
      long_term_action: "Create a buy-less default for clothing and electronics.",
      difficulty: "medium",
    },
    Waste: {
      title: "Tighten recycling and waste habits",
      summary: "Waste is a smaller but controllable part of the footprint, especially when it repeats.",
      short_term_action: "Separate recyclables for the next recordable waste event.",
      mid_term_action: "Reduce avoidable food waste by planning two meals before shopping.",
      long_term_action: "Set up a simple home sorting routine for recycling and compostable waste.",
      difficulty: "easy",
    },
    "Services & Digital Life": {
      title: "Lower digital and service footprint",
      summary: "Delivery, streaming, video calls, and hotel/service use can quietly accumulate over a month.",
      short_term_action: "Reduce unnecessary HD streaming or combine one delivery order this week.",
      mid_term_action: "Clean unused cloud storage monthly and set a weekly delivery window.",
      long_term_action: "Build lower-impact travel, delivery, and digital-service routines.",
      difficulty: "easy",
    },
  };

  const template = templates[driver.category] ?? templates["Services & Digital Life"];
  return {
    ...template,
    id: `plan_${driver.category.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    rank,
    primary_driver: driver.category,
    evidence,
    estimated_reduction_kg: round(baseReduction, 1),
    updated_at: new Date().toISOString(),
  };
}

function genericPlans(reports: CarbonReport[], existingCount: number): AdvicePlan[] {
  const avg = reports.length
    ? reports.reduce((sum, report) => sum + report.total_co2e_kg, 0) / reports.length
    : 0;
  const evidence = reports.length
    ? `Based on ${reports.length} recent records with an average of ${round(avg)} kg CO2e/day.`
    : "No 30-day history is available yet; this starter plan will update as records are added.";

  const plans: AdvicePlan[] = [
    {
      id: "plan_weekly_goal",
      rank: existingCount + 1,
      title: "Set a weekly carbon check-in",
      summary: "A light weekly rhythm helps turn carbon tracking into a habit.",
      primary_driver: "Overall footprint",
      evidence,
      short_term_action: "Record at least three normal days this week.",
      mid_term_action: "Review Insights every week and notice the largest category.",
      long_term_action: "Set a monthly reduction target once you have enough records.",
      estimated_reduction_kg: 0.8,
      difficulty: "easy",
      updated_at: new Date().toISOString(),
    },
    {
      id: "plan_top_category",
      rank: existingCount + 2,
      title: "Focus on the largest category first",
      summary: "The biggest category usually offers the clearest reduction opportunity.",
      primary_driver: "Overall footprint",
      evidence,
      short_term_action: "Pick one record from the largest category and try a lower-carbon alternative.",
      mid_term_action: "Repeat that alternative once per week.",
      long_term_action: "Make the lower-carbon version your default for that situation.",
      estimated_reduction_kg: 1,
      difficulty: "medium",
      updated_at: new Date().toISOString(),
    },
    {
      id: "plan_low_carbon_meal_default",
      rank: existingCount + 3,
      title: "Create a low-carbon meal default",
      summary: "Food habits are easy to repeat once a default option is chosen.",
      primary_driver: "Food",
      evidence,
      short_term_action: "Pick one low-carbon meal you already like and record it once this week.",
      mid_term_action: "Make that meal a weekly default.",
      long_term_action: "Keep a short list of reliable low-carbon meals for busy days.",
      estimated_reduction_kg: 1.2,
      difficulty: "easy",
      updated_at: new Date().toISOString(),
    },
    {
      id: "plan_commute_alternative",
      rank: existingCount + 4,
      title: "Test one lower-carbon route",
      summary: "Trying a route once lowers the barrier to repeating it later.",
      primary_driver: "Transport",
      evidence,
      short_term_action: "Try one public transit, walking, biking, or carpool route this week.",
      mid_term_action: "Repeat the route on the easiest day of the week.",
      long_term_action: "Turn the lower-carbon route into your default for one recurring trip.",
      estimated_reduction_kg: 1.4,
      difficulty: "medium",
      updated_at: new Date().toISOString(),
    },
    {
      id: "plan_home_energy_reset",
      rank: existingCount + 5,
      title: "Reset one home energy habit",
      summary: "Small energy settings are easy to forget, but they compound across the month.",
      primary_driver: "Energy",
      evidence,
      short_term_action: "Adjust one AC, heating, bath, or laundry habit today.",
      mid_term_action: "Repeat the lower-energy version once per week.",
      long_term_action: "Make a seasonal home energy checklist.",
      estimated_reduction_kg: 1,
      difficulty: "easy",
      updated_at: new Date().toISOString(),
    },
  ];

  return plans;
}

export function generateAdvicePlans(reports: CarbonReport[]): AdvicePlan[] {
  const normalizedReports = reports.slice(0, 30);
  const drivers = categoryTotals(normalizedReports);
  const trend = recentTrend(normalizedReports);
  const sourceDrivers = drivers.length
    ? drivers
    : fallbackBreakdown(normalizedReports).map((item) => ({
        category: item.category,
        total: item.kg_co2e,
        percentage: item.percentage,
      }));

  const plans = sourceDrivers
    .slice(0, 5)
    .map((driver, index) => planForCategory(driver, index + 1, trend));

  const withGeneric = [...plans, ...genericPlans(normalizedReports, plans.length)];
  return withGeneric.slice(0, 5).map((plan, index) => ({ ...plan, rank: index + 1 }));
}

export function loadActiveAdvicePlan(): AdvicePlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_ADVICE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdvicePlan) : null;
  } catch {
    return null;
  }
}

export function saveActiveAdvicePlan(plan: AdvicePlan): AdvicePlan {
  const selectedPlan = {
    ...plan,
    selected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  window.localStorage.setItem(ACTIVE_ADVICE_STORAGE_KEY, JSON.stringify(selectedPlan));
  window.dispatchEvent(new CustomEvent("carbonlens-active-advice-updated"));
  return selectedPlan;
}

export function mergeSelectedPlanWithLatest(
  selected: AdvicePlan | null,
  plans: AdvicePlan[],
): AdvicePlan | null {
  if (!selected) return null;
  const latest = plans.find((plan) => plan.id === selected.id);
  if (!latest || selected.user_edited) return selected;
  return {
    ...latest,
    selected_at: selected.selected_at,
  };
}
