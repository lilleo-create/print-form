export interface ShopLegalInfo {
  name?: string;
  status?: string;
  phone?: string;
  city?: string;
  referenceCategory?: string;
  catalogPosition?: string;
  ogrn?: string;
  inn?: string;
}

export interface Shop {
  id: string;
  title: string;
  avatarUrl?: string | null;
  rating?: number | null;
  reviewsCount?: number | null;
  subscribersCount?: number | null;
  ordersCount?: number | null;
  addressSlug?: string | null;
  legalInfo?: ShopLegalInfo | null;
}
