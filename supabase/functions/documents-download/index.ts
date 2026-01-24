import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Documents Download Edge Function
 * 
 * Proxies document downloads to avoid browser/extension blocking of signed URLs.
 * 
 * GUARDRAIL: User isolation
 * - Validates JWT and ensures user owns the document artifact
 * 
 * GUARDRAIL: No PHI in logs
 * - Only logs artifact_id and user_id, never filenames or content
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
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[documents-download] No auth header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.log("[documents-download] Invalid token");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Get artifact_id from query params
    const url = new URL(req.url);
    const artifactId = url.searchParams.get("artifact_id");
    
    if (!artifactId) {
      console.log("[documents-download] Missing artifact_id");
      return new Response(
        JSON.stringify({ error: "Missing artifact_id parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[documents-download] Request: artifact=${artifactId} user=${userId?.substring(0, 8)}...`);

    // Query document artifact - RLS will filter to user's own documents
    const { data: artifact, error: artifactError } = await supabase
      .from("document_artifacts")
      .select("storage_path, content_type, original_filename")
      .eq("id", artifactId)
      .eq("user_id", userId)
      .maybeSingle();

    if (artifactError) {
      console.log(`[documents-download] DB error: ${artifactError.code}`);
      return new Response(
        JSON.stringify({ error: "Failed to fetch document" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!artifact) {
      console.log(`[documents-download] Not found or unauthorized: artifact=${artifactId}`);
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download file from storage using service role for direct access
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: fileData, error: downloadError } = await adminClient.storage
      .from("documents")
      .download(artifact.storage_path);

    if (downloadError || !fileData) {
      console.log(`[documents-download] Storage error: ${downloadError?.message}`);
      return new Response(
        JSON.stringify({ error: "Failed to download document" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare safe filename
    const safeFilename = artifact.original_filename 
      ? artifact.original_filename.replace(/[^\w\-. ]/g, "_")
      : "document";

    console.log(`[documents-download] Success: artifact=${artifactId}`);

    // Return file with appropriate headers
    return new Response(fileData, {
      headers: {
        ...corsHeaders,
        "Content-Type": artifact.content_type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Cache-Control": "private, max-age=300",
      },
    });

  } catch (error) {
    console.error("[documents-download] Unexpected error:", error instanceof Error ? error.message : "unknown");
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
