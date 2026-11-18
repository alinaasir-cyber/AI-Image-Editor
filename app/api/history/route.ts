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

export async function DELETE(request: NextRequest) {
  if (!sql) {
    return NextResponse.json({ success: true });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      await sql`DELETE FROM generated_images WHERE id = ${Number(id)}`;
    } else {
      await sql`DELETE FROM generated_images`;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete from Neon:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
