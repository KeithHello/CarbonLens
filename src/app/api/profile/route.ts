import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    data: {
      userId: "default",
      storage: "local-profile",
    },
  });
}
