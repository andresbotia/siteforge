export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Timestamps = {
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      leads: {
        Row: {
          id: string;
          business_name: string;
          industry: string;
          address: string | null;
          city: string | null;
          state: string | null;
          phone: string | null;
          email: string | null;
          website_url: string | null;
          google_rating: number | null;
          review_count: number;
          status: string;
          lead_score: number | null;
          source: string | null;
          notes: string | null;
          normalized_domain: string | null;
          normalized_phone: string | null;
          qualification_tier: string | null;
          business_strength_score: number | null;
          website_opportunity_score: number | null;
          overall_qualification_score: number | null;
          qualification_reasons: Json;
          inspection_summary: Json;
          discovered_at: string | null;
          last_scout_run_id: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          business_name: string;
          industry: string;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          phone?: string | null;
          email?: string | null;
          website_url?: string | null;
          google_rating?: number | null;
          review_count?: number;
          status: string;
          lead_score?: number | null;
          source?: string | null;
          notes?: string | null;
          normalized_domain?: string | null;
          normalized_phone?: string | null;
          qualification_tier?: string | null;
          business_strength_score?: number | null;
          website_opportunity_score?: number | null;
          overall_qualification_score?: number | null;
          qualification_reasons?: Json;
          inspection_summary?: Json;
          discovered_at?: string | null;
          last_scout_run_id?: string | null;
        };
        Update: {
          phone?: string | null;
          website_url?: string | null;
          google_rating?: number | null;
          review_count?: number;
          status?: string;
          lead_score?: number | null;
          source?: string | null;
          normalized_domain?: string | null;
          normalized_phone?: string | null;
          qualification_tier?: string | null;
          business_strength_score?: number | null;
          website_opportunity_score?: number | null;
          overall_qualification_score?: number | null;
          qualification_reasons?: Json;
          inspection_summary?: Json;
          discovered_at?: string | null;
          last_scout_run_id?: string | null;
        };
        Relationships: [];
      };
      website_audits: {
        Row: {
          id: string;
          lead_id: string;
          overall_score: number | null;
          design_score: number | null;
          seo_score: number | null;
          mobile_score: number | null;
          performance_score: number | null;
          conversion_score: number | null;
          technical_score: number | null;
          ux_score: number | null;
          content_score: number | null;
          redesign_opportunity_score: number | null;
          issues: Json;
          recommendations: Json;
          summary: string | null;
          findings: Json;
          inspected_urls: Json;
          audit_version: string | null;
          source_run_id: string | null;
          pages_inspected: number;
          website_url: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          lead_id: string;
          overall_score?: number | null;
          design_score?: number | null;
          seo_score?: number | null;
          mobile_score?: number | null;
          performance_score?: number | null;
          conversion_score?: number | null;
          technical_score?: number | null;
          ux_score?: number | null;
          content_score?: number | null;
          redesign_opportunity_score?: number | null;
          issues?: Json;
          recommendations?: Json;
          summary?: string | null;
          findings?: Json;
          inspected_urls?: Json;
          audit_version?: string | null;
          source_run_id?: string | null;
          pages_inspected?: number;
          website_url?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      generated_websites: {
        Row: {
          id: string;
          lead_id: string;
          status: string;
          template: string | null;
          preview_url: string | null;
          production_url: string | null;
          repository_url: string | null;
          seo_score: number | null;
          metadata: Json;
          spec: Json;
          build_version: string | null;
          source_audit_id: string | null;
          source_run_id: string | null;
          audit_fixes: Json;
          content_provenance: Json;
          template_key: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          lead_id: string;
          status: string;
          template?: string | null;
          preview_url?: string | null;
          production_url?: string | null;
          repository_url?: string | null;
          seo_score?: number | null;
          metadata?: Json;
          spec?: Json;
          build_version?: string | null;
          source_audit_id?: string | null;
          source_run_id?: string | null;
          audit_fixes?: Json;
          content_provenance?: Json;
          template_key?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      preview_deployments: {
        Row: {
          id: string;
          generated_website_id: string;
          lead_id: string;
          approval_id: string | null;
          token_hash: string;
          token_hint: string;
          status: string;
          source_run_id: string | null;
          outreach_id: string | null;
          campaign_id: string | null;
          build_version: string | null;
          attribution: Json;
          expires_at: string | null;
          approved_at: string;
          revoked_at: string | null;
          last_viewed_at: string | null;
          view_count: number;
        } & Timestamps;
        Insert: {
          id?: string;
          generated_website_id: string;
          lead_id: string;
          approval_id?: string | null;
          token_hash: string;
          token_hint: string;
          status?: string;
          source_run_id?: string | null;
          outreach_id?: string | null;
          campaign_id?: string | null;
          build_version?: string | null;
          attribution?: Json;
          expires_at?: string | null;
          approved_at?: string;
          revoked_at?: string | null;
          last_viewed_at?: string | null;
          view_count?: number;
        };
        Update: {
          status?: string;
          outreach_id?: string | null;
          campaign_id?: string | null;
          revoked_at?: string | null;
          last_viewed_at?: string | null;
          view_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      preview_events: {
        Row: {
          id: string;
          preview_deployment_id: string;
          generated_website_id: string;
          lead_id: string;
          outreach_id: string | null;
          event_type: string;
          visitor_key: string | null;
          bot_classification: string;
          device_class: string;
          browser_class: string;
          country: string | null;
          region: string | null;
          city: string | null;
          referrer: string | null;
          path: string | null;
          metadata: Json;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          preview_deployment_id: string;
          generated_website_id: string;
          lead_id: string;
          outreach_id?: string | null;
          event_type: string;
          visitor_key?: string | null;
          bot_classification?: string;
          device_class?: string;
          browser_class?: string;
          country?: string | null;
          region?: string | null;
          city?: string | null;
          referrer?: string | null;
          path?: string | null;
          metadata?: Json;
          occurred_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      agents: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          status: string;
          enabled: boolean;
        } & Timestamps;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      agent_runs: {
        Row: {
          id: string;
          agent_id: string;
          lead_id: string | null;
          status: string;
          trigger_type: string | null;
          input: Json;
          output: Json;
          model: string | null;
          provider: string | null;
          purpose: string | null;
          failure_reason: string | null;
          input_tokens: number | null;
          output_tokens: number | null;
          estimated_cost_usd: number | null;
          actual_cost_usd: number | null;
          estimated_cost_ticks: number | string;
          approved_cost_limit_ticks: number | string;
          actual_cost_ticks: number | string;
          usage_metadata: Json;
          execution_nonce: number | string;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          lead_id?: string | null;
          status: string;
          trigger_type?: string | null;
          input?: Json;
          output?: Json;
          model?: string | null;
          provider?: string | null;
          purpose?: string | null;
          estimated_cost_usd?: number | null;
          estimated_cost_ticks?: number | string;
          approved_cost_limit_ticks?: number | string;
        };
        Update: {
          status?: string;
          failure_reason?: string | null;
          approved_cost_limit_ticks?: number | string;
          approved_cost_limit_usd?: number | null;
          actual_cost_ticks?: number | string;
          started_at?: string | null;
          completed_at?: string | null;
          output?: Json;
          purpose?: string | null;
          provider?: string | null;
        };
        Relationships: [];
      };
      agent_tool_calls: {
        Row: {
          id: string;
          agent_run_id: string;
          tool_name: string;
          action: string | null;
          request: Json;
          response: Json;
          status: string;
          provider: string | null;
          estimated_cost_usd: number | null;
          actual_cost_usd: number | null;
          estimated_cost_ticks: number | string;
          actual_cost_ticks: number | string;
          requires_approval: boolean;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          agent_run_id: string;
          tool_name: string;
          action?: string | null;
          request?: Json;
          response?: Json;
          status: string;
          provider?: string | null;
          estimated_cost_usd?: number | null;
          actual_cost_usd?: number | null;
          requires_approval?: boolean;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      approvals: {
        Row: {
          id: string;
          agent_run_id: string | null;
          lead_id: string | null;
          approval_type: string;
          status: string;
          title: string;
          description: string | null;
          payload: Json;
          estimated_cost_usd: number | null;
          approved_cost_limit_usd: number | null;
          actual_cost_usd: number | null;
          requested_cost_ticks: number | string;
          approved_cost_limit_ticks: number | string;
          actual_cost_ticks: number | string;
          resolved_by: string | null;
          requested_at: string;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_run_id?: string | null;
          lead_id?: string | null;
          approval_type: string;
          status: string;
          title: string;
          description?: string | null;
          payload?: Json;
          estimated_cost_usd?: number | null;
          requested_cost_ticks?: number | string;
          approved_cost_limit_ticks?: number | string;
        };
        Update: {
          status?: string;
          approved_cost_limit_usd?: number | null;
          approved_cost_limit_ticks?: number | string;
          actual_cost_ticks?: number | string;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Relationships: [];
      };
      ai_budget_limits: {
        Row: {
          id: number;
          daily_limit_ticks: number | string;
          monthly_limit_ticks: number | string;
          per_run_ceiling_ticks: Json;
          updated_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      ai_budget_reservations: {
        Row: {
          id: string;
          agent_run_id: string;
          approval_id: string | null;
          reserved_ticks: number | string;
          status: string;
          created_at: string;
          finalized_at: string | null;
          actual_cost_ticks: number | string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      outreach: {
        Row: {
          id: string;
          lead_id: string;
          generated_website_id: string | null;
          preview_deployment_id: string | null;
          sales_run_id: string | null;
          agent_run_id: string | null;
          approval_id: string | null;
          sender_name: string | null;
          sender_email: string | null;
          subject: string | null;
          body: string | null;
          content_hash: string | null;
          content_version: string;
          recipient_email: string | null;
          status: string;
          provider: string;
          provider_message_id: string | null;
          campaign_id: string | null;
          attribution_token_hash: string | null;
          attribution_token_hint: string | null;
          attribution_token_created_at: string | null;
          approved_at: string | null;
          sent_at: string | null;
          metadata: Json;
        } & Timestamps;
        Insert: {
          id?: string;
          lead_id: string;
          generated_website_id?: string | null;
          preview_deployment_id?: string | null;
          sales_run_id?: string | null;
          agent_run_id?: string | null;
          approval_id?: string | null;
          sender_name?: string | null;
          sender_email?: string | null;
          subject?: string | null;
          body?: string | null;
          content_hash?: string | null;
          content_version?: string;
          recipient_email?: string | null;
          status?: string;
          provider?: string;
          provider_message_id?: string | null;
          campaign_id?: string | null;
          attribution_token_hash?: string | null;
          attribution_token_hint?: string | null;
          attribution_token_created_at?: string | null;
          approved_at?: string | null;
          sent_at?: string | null;
          metadata?: Json;
        };
        Update: {
          lead_id?: string;
          generated_website_id?: string | null;
          preview_deployment_id?: string | null;
          sales_run_id?: string | null;
          agent_run_id?: string | null;
          approval_id?: string | null;
          sender_name?: string | null;
          sender_email?: string | null;
          subject?: string | null;
          body?: string | null;
          content_hash?: string | null;
          content_version?: string;
          recipient_email?: string | null;
          status?: string;
          provider?: string;
          provider_message_id?: string | null;
          campaign_id?: string | null;
          attribution_token_hash?: string | null;
          attribution_token_hint?: string | null;
          attribution_token_created_at?: string | null;
          approved_at?: string | null;
          sent_at?: string | null;
          metadata?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      outreach_events: {
        Row: {
          id: string;
          outreach_id: string;
          event_type: string;
          payload: Json;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          outreach_id: string;
          event_type: string;
          payload?: Json;
          occurred_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          lead_id: string | null;
          business_name: string;
          contact_name: string | null;
          contact_email: string | null;
          plan: string;
          status: string;
          production_url: string | null;
        } & Timestamps;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          customer_id: string;
          provider: string | null;
          provider_customer_id: string | null;
          provider_subscription_id: string | null;
          amount_usd: number;
          interval: string | null;
          status: string;
          started_at: string | null;
          cancelled_at: string | null;
        } & Timestamps;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      integration_status: {
        Row: {
          id: string;
          integration: string;
          status: string;
          last_checked_at: string | null;
          metadata: Json;
        } & Timestamps;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      activity_events: {
        Row: {
          id: string;
          event_type: string;
          actor_type: string | null;
          actor_id: string | null;
          lead_id: string | null;
          customer_id: string | null;
          title: string;
          description: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          event_type: string;
          actor_type?: string | null;
          actor_id?: string | null;
          lead_id?: string | null;
          customer_id?: string | null;
          title: string;
          description?: string | null;
          metadata?: Json;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      siteforge_reserve_ai_run: {
        Args: { p_run_id: string };
        Returns: Json;
      };
      siteforge_finalize_ai_run: {
        Args: {
          p_run_id: string;
          p_success: boolean;
          p_actual_ticks: number | string;
          p_failure_reason: string | null;
          p_usage: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
export type AuditRow = Database["public"]["Tables"]["website_audits"]["Row"];
export type WebsiteRow = Database["public"]["Tables"]["generated_websites"]["Row"];
export type PreviewDeploymentRow =
  Database["public"]["Tables"]["preview_deployments"]["Row"];
export type PreviewEventRow =
  Database["public"]["Tables"]["preview_events"]["Row"];
export type AgentRow = Database["public"]["Tables"]["agents"]["Row"];
export type AgentRunRow = Database["public"]["Tables"]["agent_runs"]["Row"];
export type ApprovalRow = Database["public"]["Tables"]["approvals"]["Row"];
export type OutreachRow = Database["public"]["Tables"]["outreach"]["Row"];
export type OutreachEventRow =
  Database["public"]["Tables"]["outreach_events"]["Row"];
export type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
export type SubscriptionRow =
  Database["public"]["Tables"]["subscriptions"]["Row"];
export type IntegrationRow =
  Database["public"]["Tables"]["integration_status"]["Row"];
export type ActivityRow = Database["public"]["Tables"]["activity_events"]["Row"];
