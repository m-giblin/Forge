import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const slug = slugify(name.trim());

  if (!slug) {
    return NextResponse.json({ slug: "", available: false, reason: "too_short" });
  }

  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("tenants")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();

  return NextResponse.json({ slug, available: !data });
}
