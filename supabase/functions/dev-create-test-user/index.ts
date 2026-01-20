import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function: dev-create-test-user
 * 
 * Creates dummy users for testing purposes (development only).
 * 
 * GUARDRAILS:
 * - Only works when APP_ENV === "development"
 * - Requires authenticated caller with email in TEST_ADMIN_EMAILS
 * - No PHI in logs (only actions and metadata)
 * - Service role key never exposed to client
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // GUARDRAIL: Dev-only check
    const appEnv = Deno.env.get("APP_ENV");
    if (appEnv !== "development") {
      console.log("dev-create-test-user: rejected - not development environment");
      return new Response(
        JSON.stringify({ ok: false, error: "Not available in this environment" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get required environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const testPassword = Deno.env.get("TEST_USER_PASSWORD");
    const adminEmailsRaw = Deno.env.get("TEST_ADMIN_EMAILS") || "";

    if (!supabaseUrl || !serviceRoleKey || !testPassword) {
      console.log("dev-create-test-user: missing required environment variables");
      return new Response(
        JSON.stringify({ ok: false, error: "Server configuration incomplete" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse admin emails allowlist
    const adminEmails = adminEmailsRaw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0);

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("dev-create-test-user: rejected - no authorization header");
      return new Response(
        JSON.stringify({ ok: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create anon client to verify caller's JWT
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    const anonClient = createClient(supabaseUrl, anonKey || "", {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await anonClient.auth.getUser();
    if (userError || !userData.user) {
      console.log("dev-create-test-user: rejected - invalid token");
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GUARDRAIL: Check caller is in admin allowlist
    const callerEmail = userData.user.email?.toLowerCase() || "";
    if (!adminEmails.includes(callerEmail)) {
      console.log("dev-create-test-user: rejected - caller not in allowlist");
      return new Response(
        JSON.stringify({ ok: false, error: "Not authorized to create test users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { email, displayName } = body;

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client with service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      // User exists, return their ID
      userId = existingUser.id;
      console.log("dev-create-test-user: existing user found", { action: "test_user_exists" });
    } else {
      // Create new user with confirmed email
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: testPassword,
        email_confirm: true,
        user_metadata: { display_name: displayName || "Test User" },
      });

      if (createError) {
        console.log("dev-create-test-user: create failed", { action: "test_user_create_error" });
        return new Response(
          JSON.stringify({ ok: false, error: "Failed to create user" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;
      console.log("dev-create-test-user: user created", { action: "test_user_created" });

      // Check if profile exists, create if not
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .single();

      if (!existingProfile) {
        await adminClient.from("profiles").insert({
          id: userId,
          display_name: displayName || "Test User",
        });
        console.log("dev-create-test-user: profile created", { action: "test_profile_created" });
      }
    }

    // Success - return minimal info (no PHI logging)
    console.log("dev-create-test-user: success", { action: "test_user_ready" });
    return new Response(
      JSON.stringify({ ok: true, userId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.log("dev-create-test-user: unexpected error", { action: "test_user_error" });
    return new Response(
      JSON.stringify({ ok: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
