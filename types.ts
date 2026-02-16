
export type UserRole = 'admin' | 'moderator' | 'user';

export interface UserProfile {
  user_id: string;
  email: string;
  role: UserRole;
  is_approved: boolean;
  created_at?: string;
}

export interface MaintenanceSystem {
  id: string;
  systemtype: string;
  brand: string;
  model: string;
  logo_url?: string;
  device_image_url?: string;
  procedure: string;
  parts?: string; // JSON string
  faults?: string; // JSON string
  checks?: string; // JSON string
  notes?: string;
  o2_low?: string;
  o2_high?: string;
  co2_low?: string;
  co2_high?: string;
  maxco?: string;
  handbook_date?: string;
  manual_url?: string;
  images?: string[];
}
