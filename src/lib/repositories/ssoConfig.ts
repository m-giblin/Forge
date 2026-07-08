import type { SupabaseClient } from "@supabase/supabase-js";

export type SsoProvider = "google" | "microsoft" | "both" | "saml";

export type SsoConfig = {
  id: string;
  tenant_id: string;
  enabled: boolean;
  provider: SsoProvider;
  allowed_domain: string | null;
  auto_provision: boolean;
  sso_required: boolean;
  saml_metadata_url: string | null;
  saml_metadata_xml: string | null;
  supabase_sso_provider_id: string | null;
  sso_domain: string | null;
  created_at: string;
  updated_at: string;
};

export type SsoConfigPatch = Partial<Pick<SsoConfig,
  "enabled" | "provider" | "allowed_domain" | "auto_provision" | "sso_required" |
  "saml_metadata_url" | "saml_metadata_xml" | "supabase_sso_provider_id" | "sso_domain"
>>;

export function ssoConfigRepo(supabase: SupabaseClient) {
  return {
    async get(tenantId: string): Promise<SsoConfig | null> {
      const { data } = await supabase
        .from("tenant_sso_config")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      return data as SsoConfig | null;
    },

    async upsert(tenantId: string, patch: SsoConfigPatch): Promise<SsoConfig> {
      const { data, error } = await supabase
        .from("tenant_sso_config")
        .upsert(
          { tenant_id: tenantId, ...patch, updated_at: new Date().toISOString() },
          { onConflict: "tenant_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data as SsoConfig;
    },

    /** Used in auth callback: find a tenant by allowed SSO domain (service-role only). */
    async getByDomain(domain: string): Promise<{ tenant_id: string; auto_provision: boolean } | null> {
      const { data } = await supabase
        .from("tenant_sso_config")
        .select("tenant_id, auto_provision")
        .eq("allowed_domain", domain)
        .eq("enabled", true)
        .maybeSingle();
      return data ?? null;
    },

    /** Check if a domain requires SSO (blocks password login). */
    async isDomainSsoRequired(domain: string): Promise<boolean> {
      const { data } = await supabase
        .from("tenant_sso_config")
        .select("sso_required")
        .eq("allowed_domain", domain)
        .eq("enabled", true)
        .eq("sso_required", true)
        .maybeSingle();
      return !!data;
    },

    /** Used on the login page: is there a live SAML provider registered for this email domain? */
    async getSamlDomain(emailDomain: string): Promise<string | null> {
      const { data } = await supabase
        .from("tenant_sso_config")
        .select("sso_domain")
        .eq("allowed_domain", emailDomain)
        .eq("provider", "saml")
        .eq("enabled", true)
        .not("supabase_sso_provider_id", "is", null)
        .maybeSingle();
      return (data?.sso_domain as string | null) ?? null;
    },
  };
}
