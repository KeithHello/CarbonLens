/**
 * GET /api/carbon/report
 * DELETE /api/carbon/report
 *
 * Reads or deletes one saved CarbonReport by session ID.
 * Query params: ?sessionId=...&userId=default
 */

import { NextRequest, NextResponse } from "next/server";
import {
  deleteCarbonReportBySession,
  getCarbonReportBySession,
} from "@/lib/mongodb";

export const runtime = "nodejs";
export const maxDuration = 30;

function readParams(request: NextRequest): { sessionId: string | null; userId: string } {
  const { searchParams } = new URL(request.url);
  return {
    sessionId: searchParams.get("sessionId"),
    userId: searchParams.get("userId") || "default",
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { sessionId, userId } = readParams(request);
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Missing sessionId parameter." },
        { status: 400 },
      );
    }

    const report = await getCarbonReportBySession(sessionId, userId);
    if (!report) {
      return NextResponse.json(
        { success: false, error: "This carbon footprint report was not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to read report: ${message}` },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { sessionId, userId } = readParams(request);
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Missing sessionId parameter." },
        { status: 400 },
      );
    }

    const deleted = await deleteCarbonReportBySession(sessionId, userId);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "No deletable report was found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to delete report: ${message}` },
      { status: 500 },
    );
  }
}
