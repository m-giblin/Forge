import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createClient } from "@supabase/supabase-js";
import { getRateLimiter } from "@/lib/providers/rate-limiter";

// IP-level rate limit: public, unauthenticated endpoint that creates a new
// auth user + tenant on every call — an obvious target for mass account
// creation / spam signups. 10/hr matches the pattern used elsewhere for
// public no-session endpoints (e.g. api/spaces/guest/request).
const SIGNUP_LIMIT = 10;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

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

// Bump this string whenever the Terms of Service / Privacy Policy meaningfully change —
// each acceptance is stamped with whichever version was current when the box was checked.
const TOS_VERSION = "2026-07-28";

export async function POST(req: NextRequest) {
  const rl = getRateLimiter();
  const ip = clientIp(req);
  const ipResult = await rl.check(`signup:ip:${ip}`, SIGNUP_LIMIT, SIGNUP_WINDOW_MS);
  if (!ipResult.allowed) {
    return NextResponse.json({ error: "Too many signup attempts from this IP. Please wait before trying again." }, { status: 429 });
  }

  let body: { name?: string; workspaceName?: string; email?: string; password?: string; phone?: string; tosAccepted?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, workspaceName, email, password, phone, tosAccepted } = body;

  if (!name?.trim() || !workspaceName?.trim() || !email?.trim() || !password || !phone?.trim()) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (!tosAccepted) {
    return NextResponse.json({ error: "You must agree to the Terms of Service and Privacy Policy." }, { status: 400 });
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
      phone_number: phone.trim(),
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

  // Create the user record (app-level users table mirrors auth.users, linked
  // via auth_id — NOT the same id, see lib/auth.ts:currentAppUserId, which is
  // the only lookup every request goes through).
  const { data: appUser, error: userError } = await svc.from("users").upsert({
    auth_id: userId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
  }, { onConflict: "auth_id" }).select("id").single();

  if (userError || !appUser) {
    // Fatal: without the users row getTenantContext() returns null for every request.
    console.error("[signup] user upsert error:", userError?.message);
    await supabaseAdmin.auth.admin.deleteUser(userId);
    await svc.from("tenants").delete().eq("id", tenant.id);
    return NextResponse.json({ error: "Failed to create account. Please try again." }, { status: 500 });
  }

  // Create owner membership
  const { error: memberError } = await svc.from("memberships").insert({
    tenant_id: tenant.id,
    user_id: appUser.id,
    role: "owner",
  });

  if (memberError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    await svc.from("tenants").delete().eq("id", tenant.id);
    return NextResponse.json({ error: "Failed to create workspace membership. Please try again." }, { status: 500 });
  }

  // Record ToS/Privacy acceptance — best-effort: a logging failure here shouldn't
  // block someone from getting the account they just successfully created.
  const { error: tosError } = await svc.from("tos_acceptances").insert({
    user_id: appUser.id,
    tenant_id: tenant.id,
    version: TOS_VERSION,
  });
  if (tosError) console.error("[signup] tos_acceptances insert failed:", tosError.message);

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
