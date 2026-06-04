/**
 * CarbonLens TypeScript type definitions.
 *
 * Central type system for carbon footprint reports, breakdowns,
 * comparisons, and reduction suggestions.
 */

export interface EmissionBreakdown {
  /** Category label, such as "Food", "Transport", or "Energy". */
  category: string;
  /** CO2 equivalent in kg for this category. */
  kg_co2e: number;
  /** Percentage of total emissions. */
  percentage: number;
}

export interface ActivityRecord {
  /** Stable identifier for deleting or editing this item. */
  id: string;
  /** User-facing activity text. */
  label: string;
  /** Category label. */
  category: string;
  /** CO2 equivalent in kg for this item. */
  kg_co2e: number;
}

export interface Comparison {
  /** Percentile rank globally (0-100, higher means more emissions). */
  global_percentile: number;
  /** Percentile rank within the user's country. */
  national_percentile: number;
  /** Ratio versus the user's 30-day personal average; null if no history exists. */
  vs_personal_avg: number | null;
  /** Global daily average in kg CO2e. */
  global_avg_kg: number;
  /** National daily average in kg CO2e. */
  national_avg_kg: number;
}

export interface Suggestion {
  rank: number;
  title: string;
  problem: string;
  suggestion: string;
  reduction_kg: number;
  difficulty: "easy" | "medium" | "hard";
  category: string;
}

export interface AdvicePlan {
  id: string;
  rank: number;
  title: string;
  summary: string;
  primary_driver: string;
  evidence: string;
  short_term_action: string;
  mid_term_action: string;
  long_term_action: string;
  estimated_reduction_kg: number;
  difficulty: "easy" | "medium" | "hard";
  user_edited?: boolean;
  selected_at?: string;
  updated_at?: string;
}

export interface CarbonReport {
  total_co2e_kg: number;
  breakdown: EmissionBreakdown[];
  records?: ActivityRecord[];
  input?: string;
  comparison: Comparison;
  suggestions: Suggestion[];
  trees_needed: number;
  session_id: string;
  timestamp: string;
  tier_label?: string;
  anomaly_flag?: string | null;
}

export interface CalculateRequest {
  input: string;
  userId?: string;
}

export interface HistoryRequest {
  userId: string;
  days?: number;
}

export interface AgentEngineResponse {
  success: boolean;
  data?: CarbonReport;
  data_list?: CarbonReport[];
  error?: string;
}

export type CarbonTier = "low" | "moderate" | "elevated" | "high" | "extreme";

export interface UserProfile {
  user_id: string;
  display_name?: string;
  country?: string;
  preferences?: UserPreferences;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  language?: "en";
  voice_enabled?: boolean;
  interested_categories?: string[];
  rejected_categories?: string[];
}
