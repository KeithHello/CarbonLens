/**
 * DELETE /api/carbon/report/record
 *
 * Deletes one activity record from a saved CarbonReport.
 * Query params: ?sessionId=...&recordId=...&userId=default
 */

import { NextRequest, NextResponse } from "next/server";
import { deleteActivityRecordById } from "@/lib/mongodb";

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const recordId = searchParams.get("recordId");
    const userId = searchParams.get("userId") || "default";

    if (!sessionId || !recordId) {
      return NextResponse.json(
        { success: false, error: "Missing sessionId or recordId parameter." },
        { status: 400 },
      );
    }

    const result = await deleteActivityRecordById(sessionId, recordId, userId);
    if (!result.deleted) {
      return NextResponse.json(
        { success: false, error: "No deletable record was found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      reportDeleted: result.reportDeleted,
      data: result.report,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to delete record: ${message}` },
      { status: 500 },
    );
  }
}
