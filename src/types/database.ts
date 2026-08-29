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
        } & Timestamps;
        Insert: Record<string, never>;
        Update: Record<string, never>;
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
          issues: Json;
          recommendations: Json;
          summary: string | null;
        } & Timestamps;
        Insert: Record<string, never>;
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
        } & Timestamps;
        Insert: Record<string, never>;
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
          input_tokens: number | null;
          output_tokens: number | null;
          estimated_cost_usd: number | null;
          actual_cost_usd: number | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
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
          estimated_cost_usd: number | null;
          actual_cost_usd: number | null;
          requires_approval: boolean;
          created_at: string;
          completed_at: string | null;
        };
        Insert: Record<string, never>;
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
          requested_at: string;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      outreach: {
        Row: {
          id: string;
          lead_id: string;
          agent_run_id: string | null;
          approval_id: string | null;
          subject: string | null;
          body: string | null;
          recipient_email: string | null;
          status: string;
          provider_message_id: string | null;
          sent_at: string | null;
        } & Timestamps;
        Insert: Record<string, never>;
        Update: Record<string, never>;
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
        Insert: Record<string, never>;
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
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
export type AuditRow = Database["public"]["Tables"]["website_audits"]["Row"];
export type WebsiteRow = Database["public"]["Tables"]["generated_websites"]["Row"];
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
