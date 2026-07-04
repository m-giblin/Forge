import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createClient } from "@supabase/supabase-js";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function uniqueSlug(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

export async function POST(req: NextRequest) {
  let body: { name?: string; workspaceName?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, workspaceName, email, password } = body;

  if (!name?.trim() || !workspaceName?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const svc = createSupabaseServiceClient();

  // Create the auth user via service-role admin API
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: name.trim() },
  });

  if (authError || !authData.user) {
    const msg = authError?.message ?? "Failed to create account.";
    if (msg.includes("already registered") || msg.includes("already been registered")) {
      return NextResponse.json({ error: "An account with that email already exists. Please sign in." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const userId = authData.user.id;

  // Derive a slug and ensure uniqueness
  const baseSlug = slugify(workspaceName.trim()) || "workspace";

  const { data: existing } = await svc
    .from("tenants")
    .select("slug")
    .eq("slug", baseSlug)
    .maybeSingle();

  const slug = existing ? uniqueSlug(baseSlug) : baseSlug;

  // Trial window: 14 days from now
  const now = new Date();
  const trialEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // Create tenant with trial fields
  const { data: tenant, error: tenantError } = await svc
    .from("tenants")
    .insert({
      name: workspaceName.trim(),
      slug,
      status: "active",
      plan: "premium",
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
      subscription_status: "trialing",
      subscription_tier: "premium",
      subscription_seats: 1,
      billing_email: email.trim().toLowerCase(),
    })
    .select("id, slug")
    .single();

  if (tenantError || !tenant) {
    // Roll back the auth user so they can retry
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Failed to create workspace. Please try again." }, { status: 500 });
  }

  // Create the user record (app-level users table mirrors auth.users)
  const { error: userError } = await svc.from("users").upsert({
    id: userId,
    full_name: name.trim(),
    email: email.trim().toLowerCase(),
  }, { onConflict: "id" });

  if (userError) {
    // Fatal: without the users row getTenantContext() returns null for every request.
    console.error("[signup] user upsert error:", userError.message);
    await supabaseAdmin.auth.admin.deleteUser(userId);
    await svc.from("tenants").delete().eq("id", tenant.id);
    return NextResponse.json({ error: "Failed to create account. Please try again." }, { status: 500 });
  }

  // Create owner membership
  const { error: memberError } = await svc.from("memberships").insert({
    tenant_id: tenant.id,
    user_id: userId,
    role: "owner",
  });

  if (memberError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    await svc.from("tenants").delete().eq("id", tenant.id);
    return NextResponse.json({ error: "Failed to create workspace membership. Please try again." }, { status: 500 });
  }

  // Sign the user in immediately so their browser has a session
  const { error: signInError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: email.trim().toLowerCase(),
  });

  // Best-effort sign-in: create a session via the regular client
  const supabaseRegular = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  await supabaseRegular.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  // Suppress unused variable warning
  void signInError;

  return NextResponse.json({ slug: tenant.slug }, { status: 201 });
}
