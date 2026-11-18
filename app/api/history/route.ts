import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  const _ = request.nextUrl.searchParams;
  if (!sql) {
    return NextResponse.json({ history: [] });
  }

  try {
    const rows = await sql`
      SELECT id, url, prompt, type, created_at
      FROM generated_images
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return NextResponse.json({ history: rows });
  } catch (error: any) {
    console.error("Failed to fetch history from Neon:", error);
    return NextResponse.json({ history: [] });
  }
}
