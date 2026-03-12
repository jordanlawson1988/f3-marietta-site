export interface Region {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_primary: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
