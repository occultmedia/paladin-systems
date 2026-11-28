/*
 * Supabase database types for Baseline, in the shape `supabase gen types
 * typescript` produces. Mirrors:
 *   supabase/migrations/20261121000000_profiles_feed.sql
 *   supabase/migrations/20261122000000_delta_pipeline.sql
 * Regenerate once the project exists:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 *
 * raw_listings / raw_listing_deltas / scrape_runs writes are here for the
 * service-role Index job only; RLS denies them to the browser client.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AssetClass = "Property" | "Land" | "Commercial";
export type PropertyTypeDb = "Villa" | "Estate" | "Penthouse" | "Beach House" | "Condo" | "Apartment" | "Townhouse" | "Land" | "Commercial";
export type CommercialUseDb = "Retail" | "Office" | "Hospitality" | "Mixed-use" | "Warehouse";
export type ZoningDb = "Residential" | "Tourism" | "Commercial" | "Agricultural";
export type TenureDb = "Eigendom" | "Erfpacht";
export type PoolDb = "Private pool" | "Shared pool" | "No pool";
export type ListingStatusDb = "For sale" | "Under contract" | "Sold" | "De-listed";
export type RecordStatus = "active" | "archived";
export type SignalDb = "UNDERVALUED" | "AT_MARKET" | "OVERPRICED";
export type FlagType = "sold" | "off_market" | "ghost" | "duplicate";
export type ListingEventType = "Listed" | "Price drop" | "Price increase" | "Status change";
export type DealSide = "bid" | "ask";
export type DealKind = "Off-market" | "For sale" | "Buyer request" | "For rent" | "Partnership";
export type MemberRole = "Agent" | "Investor" | "Brokerage";
export type FeedKind = "Update" | DealKind;
export type IndexRunStatus = "running" | "succeeded" | "failed";
export type AgentListingVisibility = "members" | "private";
export type AgentListingStatus = "For sale" | "Under contract" | "Sold" | "Withdrawn";

/** Columns an agent fills in (table: agent_listings). */
export type AgentListingFields = {
  visibility: AgentListingVisibility;
  asset_class: AssetClass;
  property_type: PropertyTypeDb;
  commercial_use: CommercialUseDb | null;
  zoning: ZoningDb | null;
  asset_name: string;
  bedrooms: number | null;
  bathrooms: number | null;
  built_sqft: number | null;
  lot_sqft: number | null;
  pool: PoolDb | null;
  tenure: TenureDb;
  lease_years_left: number | null;
  district: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  asking_price_usd: number;
  listing_status: AgentListingStatus;
  notes: string | null;
  photo_url: string | null;
  dup_acknowledged: boolean;
};

export type AgentListingRow = AgentListingFields & {
  id: string;
  ref: string; // 'AG-1A2B3C4D'
  owner_id: string;
  market_id: string;
  match_kind: "market" | "member" | null;
  match_ref: string | null;
  match_name: string | null;
  match_score: number | null;
  market_listing_id: string | null;
  went_public_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentListingViewRow = AgentListingRow & {
  owner_name: string;
  owner_role: MemberRole;
  owner_company: string;
  owner_title: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  owner_whatsapp: string | null;
  owner_photo_url: string | null;
  owner_logo_url: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          role: MemberRole;
          company: string;
          title: string | null;
          email: string | null;
          phone: string | null;
          whatsapp: string | null;
          photo_url: string | null;
          logo_url: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          role?: MemberRole;
          company?: string;
          title?: string | null;
          email?: string | null;
          phone?: string | null;
          whatsapp?: string | null;
          photo_url?: string | null;
          logo_url?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      feed_posts: {
        Row: {
          id: string;
          author_id: string;
          kind: FeedKind;
          title: string;
          body: string;
          price_usd: number | null;
          district: string | null;
          listing_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          kind: FeedKind;
          title: string;
          body: string;
          price_usd?: number | null;
          district?: string | null;
          listing_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["feed_posts"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "feed_posts_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      scrape_runs: {
        Row: {
          id: number;
          started_at: string;
          finished_at: string | null;
          status: IndexRunStatus;
          sources_checked: number;
          listings_checked: number;
          rows_new: number;
          rows_changed: number;
          rows_unchanged: number;
          error: string | null;
        };
        Insert: {
          id?: never;
          started_at?: string;
          finished_at?: string | null;
          status?: IndexRunStatus;
          sources_checked?: number;
          listings_checked?: number;
          rows_new?: number;
          rows_changed?: number;
          rows_unchanged?: number;
          error?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["scrape_runs"]["Insert"]>;
        Relationships: [];
      };
      agencies: {
        Row: {
          id: string;
          name: string;
          website: string | null;
          logo_url: string | null;
          color: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          website?: string | null;
          logo_url?: string | null;
          color?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["agencies"]["Insert"]>;
        Relationships: [];
      };
      listing_agents: {
        Row: {
          id: string;
          agency_id: string;
          name: string;
          title: string | null;
          phone: string | null;
          whatsapp: boolean;
          email: string | null;
          photo_url: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          agency_id: string;
          name: string;
          title?: string | null;
          phone?: string | null;
          whatsapp?: boolean;
          email?: string | null;
          photo_url?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["listing_agents"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "listing_agents_agency_id_fkey"; columns: ["agency_id"]; isOneToOne: false; referencedRelation: "agencies"; referencedColumns: ["id"] },
        ];
      };
      raw_listings: {
        Row: {
          id: number;
          agency_id: string;
          source_url: string;
          source_listing_id: string | null;
          raw_title: string | null;
          raw_price: string | null;
          raw_currency: string | null;
          raw_beds: string | null;
          raw_baths: string | null;
          raw_built_area: string | null;
          raw_lot_area: string | null;
          raw_property_type: string | null;
          raw_status: string | null;
          raw_address: string | null;
          raw_district: string | null;
          raw_tenure: string | null;
          raw_description: string | null;
          raw_agent: Json | null;
          raw_photos: string[];
          raw_lat: number | null;
          raw_lng: number | null;
          raw_payload: Json;
          content_hash: string;
          first_scraped_at: string;
          last_scraped_at: string;
          last_changed_at: string;
          first_run_id: number | null;
          last_run_id: number | null;
          scrape_count: number;
          property_id: string | null;
          processed_at: string | null;
          process_error: string | null;
        };
        Insert: {
          id?: never;
          agency_id: string;
          source_url: string;
          source_listing_id?: string | null;
          raw_title?: string | null;
          raw_price?: string | null;
          raw_currency?: string | null;
          raw_beds?: string | null;
          raw_baths?: string | null;
          raw_built_area?: string | null;
          raw_lot_area?: string | null;
          raw_property_type?: string | null;
          raw_status?: string | null;
          raw_address?: string | null;
          raw_district?: string | null;
          raw_tenure?: string | null;
          raw_description?: string | null;
          raw_agent?: Json | null;
          raw_photos?: string[];
          raw_lat?: number | null;
          raw_lng?: number | null;
          raw_payload?: Json;
          content_hash: string;
          first_scraped_at?: string;
          last_scraped_at?: string;
          last_changed_at?: string;
          first_run_id?: number | null;
          last_run_id?: number | null;
          scrape_count?: number;
          property_id?: string | null;
          processed_at?: string | null;
          process_error?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["raw_listings"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "raw_listings_agency_id_fkey"; columns: ["agency_id"]; isOneToOne: false; referencedRelation: "agencies"; referencedColumns: ["id"] },
          { foreignKeyName: "raw_listings_property_fk"; columns: ["property_id"]; isOneToOne: false; referencedRelation: "property_master"; referencedColumns: ["id"] },
        ];
      };
      property_master: {
        Row: {
          id: string;
          listing_id: string;
          market_id: string;
          asset_class: AssetClass;
          property_type: PropertyTypeDb;
          commercial_use: CommercialUseDb | null;
          zoning: ZoningDb | null;
          asset_name: string;
          bedrooms: number | null;
          bathrooms: number | null;
          built_sqft: number | null;
          lot_sqft: number | null;
          pool: PoolDb | null;
          tenure: TenureDb | null;
          lease_years_left: number | null;
          district: string;
          address: string | null;
          lat: number;
          lng: number;
          asking_price_usd: number;
          first_price_usd: number;
          /** generated: asking / built (lot for land) */
          price_per_sqft_usd: number | null;
          /** generated: % change since first listed */
          price_change_pct: number | null;
          last_price_change_at: string | null;
          signal: SignalDb;
          comps_psf_usd: number | null;
          comps_count: number | null;
          price_vs_comps_pct: number | null;
          district_psf_usd: number | null;
          price_vs_district_pct: number | null;
          signal_updated_at: string | null;
          agency_id: string;
          agent_id: string | null;
          source_url: string | null;
          photo_url: string | null;
          photos: string[];
          listing_status: ListingStatusDb;
          status_changed_at: string | null;
          first_seen: string;
          days_on_market: number;
          last_scraped_at: string;
          last_run_id: number | null;
          status: RecordStatus;
          confidence_score: number;
          confidence_updated_at: string | null;
          archived_at: string | null;
          archived_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          market_id?: string;
          asset_class: AssetClass;
          property_type: PropertyTypeDb;
          commercial_use?: CommercialUseDb | null;
          zoning?: ZoningDb | null;
          asset_name: string;
          bedrooms?: number | null;
          bathrooms?: number | null;
          built_sqft?: number | null;
          lot_sqft?: number | null;
          pool?: PoolDb | null;
          tenure?: TenureDb | null;
          lease_years_left?: number | null;
          district: string;
          address?: string | null;
          lat: number;
          lng: number;
          asking_price_usd: number;
          /** filled from asking_price_usd on insert; never changes afterwards */
          first_price_usd?: number;
          price_per_sqft_usd?: never;
          price_change_pct?: never;
          last_price_change_at?: string | null;
          signal?: SignalDb;
          comps_psf_usd?: number | null;
          comps_count?: number | null;
          price_vs_comps_pct?: number | null;
          district_psf_usd?: number | null;
          price_vs_district_pct?: number | null;
          signal_updated_at?: string | null;
          agency_id: string;
          agent_id?: string | null;
          source_url?: string | null;
          photo_url?: string | null;
          photos?: string[];
          listing_status?: ListingStatusDb;
          status_changed_at?: string | null;
          first_seen?: string;
          days_on_market?: number;
          last_scraped_at?: string;
          last_run_id?: number | null;
          status?: RecordStatus;
          confidence_score?: number;
          confidence_updated_at?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["property_master"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "property_master_agency_id_fkey"; columns: ["agency_id"]; isOneToOne: false; referencedRelation: "agencies"; referencedColumns: ["id"] },
          { foreignKeyName: "property_master_agent_id_fkey"; columns: ["agent_id"]; isOneToOne: false; referencedRelation: "listing_agents"; referencedColumns: ["id"] },
        ];
      };
      listing_events: {
        Row: {
          id: number;
          property_id: string;
          run_id: number | null;
          event: ListingEventType;
          observed_on: string;
          price_usd: number | null;
          change_pct: number | null;
          old_status: ListingStatusDb | null;
          new_status: ListingStatusDb | null;
          created_at: string;
        };
        /** written by the property_master trigger only */
        Insert: never;
        Update: never;
        Relationships: [
          { foreignKeyName: "listing_events_property_id_fkey"; columns: ["property_id"]; isOneToOne: false; referencedRelation: "property_master"; referencedColumns: ["id"] },
        ];
      };
      property_flags: {
        Row: {
          id: number;
          user_id: string;
          property_id: string;
          flag_type: FlagType;
          note: string | null;
          previous_status: RecordStatus | null;
          previous_score: number | null;
          created_at: string;
          undone_at: string | null;
          disputed: boolean;
        };
        /** Members insert property_id + flag_type (+ note); user_id defaults to auth.uid(). */
        Insert: {
          id?: never;
          user_id?: string;
          property_id: string;
          flag_type: FlagType;
          note?: string | null;
        };
        Update: never;
        Relationships: [
          { foreignKeyName: "property_flags_property_id_fkey"; columns: ["property_id"]; isOneToOne: false; referencedRelation: "property_master"; referencedColumns: ["id"] },
        ];
      };
      agent_listings: {
        Row: AgentListingRow;
        Insert: Partial<AgentListingFields> & Pick<AgentListingFields, "asset_class" | "property_type" | "asset_name" | "district" | "asking_price_usd"> & { owner_id?: string; market_id?: string };
        Update: Partial<AgentListingFields>;
        Relationships: [
          { foreignKeyName: "agent_listings_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      deal_desk_posts: {
        Row: {
          id: string;
          author_id: string;
          side: DealSide;
          kind: DealKind;
          asset_class: AssetClass;
          property_type: PropertyTypeDb | null;
          district: string | null;
          title: string;
          notes: string;
          budget_min: number | null;
          budget_max: number | null;
          listing_id: string | null;
          is_blind: boolean;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          author_id?: string;
          side: DealSide;
          kind?: DealKind;
          asset_class: AssetClass;
          property_type?: PropertyTypeDb | null;
          district?: string | null;
          title: string;
          notes: string;
          budget_min?: number | null;
          budget_max?: number | null;
          listing_id?: string | null;
          is_blind?: boolean;
          /** capped at created_at + 14 days by the database */
          expires_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["deal_desk_posts"]["Insert"], "author_id">>;
        Relationships: [
          { foreignKeyName: "deal_desk_posts_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "deal_desk_posts_listing_id_fkey"; columns: ["listing_id"]; isOneToOne: false; referencedRelation: "property_master"; referencedColumns: ["id"] },
        ];
      };
      deal_desk_interest: {
        Row: {
          post_id: string;
          user_id: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id?: string;
          note?: string | null;
        };
        Update: never;
        Relationships: [
          { foreignKeyName: "deal_desk_interest_post_id_fkey"; columns: ["post_id"]; isOneToOne: false; referencedRelation: "deal_desk_posts"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: {
      v_agent_listings: {
        Row: AgentListingViewRow;
        Relationships: [];
      };
      v_deal_desk_interest: {
        Row: {
          post_id: string;
          user_id: string;
          note: string | null;
          created_at: string;
          name: string;
          role: MemberRole;
          company: string;
          title: string | null;
          email: string | null;
          phone: string | null;
          whatsapp: string | null;
          photo_url: string | null;
          logo_url: string | null;
        };
        Relationships: [];
      };
      v_market_items: {
        // one row per visible listing (indexed and members'); see the grouping migration. Only the columns the app reads.
        Row: {
          ref: string;
          kind: "indexed" | "member";
          group_key: string;
          group_type: GroupType;
          property_id: string | null;
          project_id: string | null;
          status: ListingStatusDb;
        };
        Relationships: [];
      };
      v_master_market: {
        Row: {
          property_id: string;
          listing_id: string;
          market_id: string;
          category: AssetClass;
          property_type: PropertyTypeDb;
          commercial_use: CommercialUseDb | null;
          zoning: ZoningDb | null;
          asset_name: string;
          district: string;
          address: string | null;
          lat: number;
          lng: number;
          bedrooms: number | null;
          bathrooms: number | null;
          built_sqft: number | null;
          lot_sqft: number | null;
          pool: PoolDb | null;
          tenure: TenureDb | null;
          lease_years_left: number | null;
          asking_price_usd: number;
          first_price_usd: number;
          price_per_sqft_usd: number | null;
          price_change_pct: number | null;
          last_price_change_at: string | null;
          signal: SignalDb;
          comps_psf_usd: number | null;
          comps_count: number | null;
          price_vs_comps_pct: number | null;
          district_psf_usd: number | null;
          price_vs_district_pct: number | null;
          status: ListingStatusDb;
          status_changed_at: string | null;
          first_seen: string;
          days_on_market: number;
          is_new: boolean;
          last_found_at: string;
          last_scraped: string;
          confidence_score: number;
          source_url: string | null;
          photo_url: string | null;
          photos: string[];
          source: string;
          agency: { id: string; name: string; website: string | null; logo_url: string | null; color: string };
          agent: {
            id: string;
            name: string;
            title: string | null;
            phone: string | null;
            whatsapp: boolean;
            email: string | null;
            photo_url: string | null;
            agency_id: string;
          } | null;
          price_history: Array<{ date: string; event: "Listed" | "Price drop" | "Price increase"; price_usd: number; change_pct: number | null }>;
        };
        Relationships: [];
      };
      v_market_events: {
        Row: {
          id: number;
          run_id: number | null;
          observed_on: string;
          event: ListingEventType;
          price_usd: number | null;
          change_pct: number | null;
          old_status: ListingStatusDb | null;
          new_status: ListingStatusDb | null;
          created_at: string;
          listing_id: string;
          asset_name: string;
          district: string;
          category: AssetClass;
          agency_id: string;
        };
        Relationships: [];
      };
      deal_desk_feed: {
        Row: {
          id: string;
          side: DealSide;
          kind: DealKind;
          asset_class: AssetClass;
          property_type: PropertyTypeDb | null;
          district: string | null;
          title: string;
          notes: string;
          budget_min: number | null;
          budget_max: number | null;
          /** public listing ref ('AW-0388') of an attached Baseline listing */
          listing_ref: string | null;
          is_blind: boolean;
          created_at: string;
          expires_at: string;
          is_mine: boolean;
          author_role: MemberRole;
          /** null on blind posts */
          author_name: string | null;
          author_company: string | null;
          author_title: string | null;
          author_photo_url: string | null;
          author_logo_url: string | null;
          author_email: string | null;
          author_phone: string | null;
          author_whatsapp: string | null;
          /** only on your own posts */
          interest_count: number | null;
          i_am_interested: boolean;
        };
        Relationships: [];
      };
      raw_listing_deltas: {
        Row: Database["public"]["Tables"]["raw_listings"]["Row"] & { is_new_source: boolean };
        Relationships: [];
      };
      v_flag_review: {
        Row: {
          created_at: string;
          listing_id: string;
          asset_name: string;
          source: string;
          flag_type: FlagType;
          note: string | null;
          disputed: boolean;
          undone_at: string | null;
          user_id: string;
          flagged_by_name: string | null;
          flagged_by_company: string | null;
          member_flag_count: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      listing_match_score: {
        Args: {
          a_class: string; b_class: string; a_lat: number | null; a_lng: number | null; b_lat: number | null; b_lng: number | null;
          a_district: string; b_district: string; a_beds: number | null; b_beds: number | null; a_built: number | null; b_built: number | null;
          a_lot: number | null; b_lot: number | null; a_price: number; b_price: number; a_name: string; b_name: string;
        };
        Returns: number;
      };
      flag_delisted: { Args: { p_listing_id: string; p_reason: FlagType; p_note?: string | null }; Returns: undefined };
      undo_flag: { Args: { p_listing_id: string }; Returns: undefined };
      mark_raw_processed: { Args: { p_raw_id: number; p_property_id: string | null; p_error?: string | null; p_price_usd?: number | null }; Returns: undefined };
      // Grouped map and list (supabase/migrations/20261128000000_grouping_map_rpcs.sql). `f`: see MarketFilters in lib/market-api.ts.
      get_map_pins: { Args: { f: Record<string, unknown> }; Returns: MapPinRow[] };
      get_listing_page: {
        Args: { f: Record<string, unknown>; p_sort: string; p_dir: "asc" | "desc"; p_cursor: Record<string, unknown> | null; p_limit: number };
        Returns: ListingPageRow;
      };
      get_market_facets: { Args: { f: Record<string, unknown> }; Returns: MarketFacetsRow };
      get_group_detail: { Args: { p_group_key: string }; Returns: GroupDetailRow };
      purge_expired_deal_desk_posts: { Args: Record<PropertyKey, never>; Returns: number };
      deal_post_open_for_interest: { Args: { p_post_id: string }; Returns: boolean };
      aruba_today: { Args: Record<PropertyKey, never>; Returns: string };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];

export type MasterMarketRow = Views<"v_master_market">;

/* ── grouped map and list (RPC results) ─────────────────────────────── */

/** 'project' = a building or development (p:<id>), 'property' = one home, maybe listed by several agencies (h:<id>), 'member' = a member's own listing (m:<id>). */
export type GroupType = "project" | "property" | "member";

export interface MapPinRow {
  group_key: string;
  group_type: GroupType;
  title: string;
  lat: number;
  lng: number;
  min_price: number;
  max_price: number;
  unit_count: number;
  agency_count: number;
  agency_ids: string[];
  rep_ref: string;
  category: AssetClass;
  signal: SignalDb | "NO_SIGNAL";
  district: string;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqft: number | null;
  is_new: boolean;
  price_change_pct: number | null;
  thumbnail_url: string | null;
}

export interface ListingGroupRow {
  group_key: string;
  group_type: GroupType;
  title: string;
  lat: number;
  lng: number;
  min_price: number;
  max_price: number;
  unit_count: number;
  agency_ids: string[];
  agency_count: number;
  rep_ref: string;
  rep_kind: "indexed" | "member";
  /** The group's cheapest matching listing, as v_master_market (null for a member's listing). */
  rep: MasterMarketRow | null;
}

export interface ListingPageRow {
  total: number;
  items: ListingGroupRow[];
  next_cursor: { n: number; t: string; k: string } | null;
}

export interface MarketFacetsRow {
  status_counts: Partial<Record<ListingStatusDb, number>>;
  groups: number;
  listings: number;
  residential: number;
  land: number;
  commercial: number;
  median_price: number | null;
  below_market: number;
  new_today: number;
  off_market: number;
  agencies: Array<{ id: string; name: string; logo_url: string | null; count: number }>;
  districts: string[];
  updated_at: string | null;
}

/** One agency's own listing of a home: its price and its page. */
export interface OfferRow {
  agency_id: string;
  agency: string;
  logo_url: string | null;
  website: string | null;
  price_usd: number | null;
  source_url: string | null;
  last_seen: string | null;
  primary: boolean;
}

export interface GroupDetailRow {
  group_key: string;
  group_type: GroupType | null;
  project: { id: string; name: string; district: string | null; lat: number | null; lng: number | null } | null;
  units: Array<{ ref: string; kind: "indexed" | "member"; listing: MasterMarketRow | null; offers: OfferRow[] | null }>;
}
export type DealDeskFeedRow = Views<"deal_desk_feed">;
export type DealInterestRow = Views<"v_deal_desk_interest">;
