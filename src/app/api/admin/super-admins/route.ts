import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/super-admin";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const svc = () => createSupabaseServiceClient();

// GET — list all super admins
export async function GET() {
  const sa = await requireSuperAdmin();
  if (!sa) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await svc()
    .from("super_admins")
    .select("user_id, created_at, user:user_id(id, email, name)")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST — invite by email + grant super-admin
export async function POST(req: NextRequest) {
  const sa = await requireSuperAdmin();
  if (!sa) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, name } = await req.json();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const client = svc();

  // Invite via Supabase auth (idempotent — re-sends if already exists)
  const { error: inviteErr } = await client.auth.admin.inviteUserByEmail(email, {
    data: name ? { full_name: name } : undefined,
  });
  // "already been registered" is fine — they exist, we'll just grant access
  if (inviteErr && !inviteErr.message.includes("already been registered")) {
    return NextResponse.json({ error: inviteErr.message }, { status: 400 });
  }

  // Find auth user
  const { data: { users }, error: listErr } = await client.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  const authUser = users.find((u) => u.email === email);
  if (!authUser) return NextResponse.json({ error: "User not found after invite" }, { status: 500 });

  // Upsert app user row
  const { data: appUserRow, error: upsertErr } = await client
    .from("users")
    .upsert({ auth_id: authUser.id, email, name: name ?? null }, { onConflict: "auth_id", ignoreDuplicates: false })
    .select("id")
    .maybeSingle();
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  let appUserId = appUserRow?.id;
  if (!appUserId) {
    const { data: existing } = await client.from("users").select("id").eq("auth_id", authUser.id).maybeSingle();
    appUserId = existing?.id;
  }
  if (!appUserId) return NextResponse.json({ error: "Could not resolve app user" }, { status: 500 });

  // Grant super-admin
  const { error: saErr } = await client
    .from("super_admins")
    .upsert({ user_id: appUserId }, { onConflict: "user_id", ignoreDuplicates: true });
  if (saErr) return NextResponse.json({ error: saErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, appUserId });
}

// DELETE — revoke super-admin (cannot revoke yourself)
export async function DELETE(req: NextRequest) {
  const sa = await requireSuperAdmin();
  if (!sa) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (userId === sa.appUserId) {
    return NextResponse.json({ error: "You cannot revoke your own platform access" }, { status: 400 });
  }

  const { error } = await svc().from("super_admins").delete().eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
