import { createClient } from '@supabase/supabase-js';

export interface Database {
  public: {
    Tables: {
      devices: {
        Row: {
          id: string;
          device_code: string;
          name: string;
          device_type: string;
          lat: number;
          lng: number;
          status: string;
          department: string;
          description: string | null;
          range_meters: number | null;
          sketch_pin: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          device_code: string;
          name: string;
          device_type: string;
          lat: number;
          lng: number;
          status: string;
          department: string;
          description?: string | null;
          range_meters?: number | null;
          sketch_pin?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          device_code?: string;
          name?: string;
          device_type?: string;
          lat?: number;
          lng?: number;
          status?: string;
          department?: string;
          description?: string | null;
          range_meters?: number | null;
          sketch_pin?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      complaints: {
        Row: {
          id: string;
          device_id: string;
          device_type: string;
          device_name: string;
          location: string | null;
          status: string;
          description: string | null;
          image_url: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          device_id: string;
          device_type: string;
          device_name: string;
          location?: string | null;
          status: string;
          description?: string | null;
          image_url?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          device_id?: string;
          device_type?: string;
          device_name?: string;
          location?: string | null;
          status?: string;
          description?: string | null;
          image_url?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      custom_device_types: {
        Row: {
          id: string;
          type_code: string;
          label: string;
          icon: string;
          color: string | null;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          type_code: string;
          label: string;
          icon?: string;
          color?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          type_code?: string;
          label?: string;
          icon?: string;
          color?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey)
    : null;

export const isSupabaseEnabled = Boolean(supabase);
