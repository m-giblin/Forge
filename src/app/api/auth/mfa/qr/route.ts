import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  // Must be authenticated to generate a QR for enrollment.
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { uri } = await req.json();
  if (!uri) return NextResponse.json({ error: "uri required" }, { status: 400 });

  // Return a PNG data URL — safer than inline SVG (SVG supports <script> tags).
  const dataUrl = await QRCode.toDataURL(uri, { width: 200, margin: 2 });
  return NextResponse.json({ dataUrl });
}
