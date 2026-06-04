/**
 * POST /api/carbon/calculate
 *
 * Calls Agent Platform, normalizes the report timestamp, and persists the
 * completed CarbonReport in MongoDB for history/report pages.
 */

import { NextRequest, NextResponse } from "next/server";
import { calculateCarbon } from "@/lib/agent-client";
import { saveCarbonReport } from "@/lib/mongodb";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();

  try {
    const body = await request.json();
    if (!body || typeof body.input !== "string" || body.input.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid activity description." },
        { status: 400 },
      );
    }

    const input = body.input.trim();
    const userId: string = body.userId?.trim() || "default";
    const result = await calculateCarbon({ input, userId });

    if (!result.success || !result.data) {
      return NextResponse.json(
        {
          success: false,
          error:
            result.error ||
            "The calculation service is temporarily unavailable. Please try again.",
        },
        { status: 502 },
      );
    }

    let data = result.data;
    let persistenceWarning: string | undefined;
    try {
      data = await saveCarbonReport(result.data, userId, input);
    } catch (error) {
      persistenceWarning =
        error instanceof Error ? error.message : "Failed to persist report.";
    }

    return NextResponse.json({
      success: true,
      data,
      meta: {
        elapsed_ms: Date.now() - startedAt,
        persisted: !persistenceWarning,
        persistence_warning: persistenceWarning,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Request handling failed: ${message}` },
      { status: 500 },
    );
  }
}
