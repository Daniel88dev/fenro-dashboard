import { NextResponse } from "next/server";

// Kept dependency-free so any host can point a check at it.
export function GET() {
  return NextResponse.json({
    status: "ok",
    checkedAt: new Date().toISOString(),
  });
}
