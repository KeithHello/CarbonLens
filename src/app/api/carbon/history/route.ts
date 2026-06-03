/**
 * GET /api/carbon/history
 *
 * Reads saved carbon reports from MongoDB.
 * Query params: ?userId=default&days=30
 */

import { NextRequest, NextResponse } from "next/server";
import { listCarbonReports } from "@/lib/mongodb";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "default";
    const daysParam = searchParams.get("days");
    const days = daysParam ? parseInt(daysParam, 10) : 30;

    if (Number.isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json(
        { success: false, error: "The days parameter must be between 1 and 365." },
        { status: 400 },
      );
    }

    const reports = await listCarbonReports(userId, days);
    return NextResponse.json({ success: true, data: reports });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to query history: ${message}` },
      { status: 500 },
    );
  }
}
