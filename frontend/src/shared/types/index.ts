export type MaterialType = 'PLA' | 'ABS' | 'PETG' | 'RESIN';
export type TechnologyType = 'FDM' | 'SLA';
export type Role = 'buyer' | 'seller';
export type OrderStatus = 'processing' | 'printing' | 'shipped' | 'delivered';
export type OrderItemStatus = 'new' | OrderStatus;

export interface Product {
  id: string;
  title: string;
  category: string;
  price: number;
  image: string;
  description: string;
  descriptionShort?: string;
  descriptionFull?: string;
  sku?: string;
  currency?: string;
  ratingAvg?: number;
  ratingCount?: number;
  material: MaterialType;
  size: string;
  technology: TechnologyType;
  printTime: string;
  color: string;
  sellerId: string | null;
  images?: ProductImage[];
  variants?: ProductVariant[];
  specs?: ProductSpec[];
  deliveryDateNearest?: string;
  deliveryDateEstimated?: string;
  deliveryDates?: string[];
  imageUrls?: string[];
}

export interface ProductImage {
  id: string;
  url: string;
  sortOrder: number;
}

export interface ProductVariant {
  id: string;
  productId?: string;
  name: string;
  options: Record<string, string[]>;
  priceDelta?: number;
  sku?: string;
  stock?: number;
  productId?: string;
  linkedProductId?: string;
}

export interface ProductSpec {
  id: string;
  key: string;
  value: string;
  sortOrder: number;
}

export interface Review {
  id: string;
  productId?: string;
  userId?: string | null;
  rating: number;
  pros: string;
  cons: string;
  comment: string;
  photos?: string[];
  likesCount?: number;
  dislikesCount?: number;
  createdAt: string;
  user?: { id: string; name: string } | null;
  product?: { id: string; title: string; image?: string };
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderItem {
  productId: string;
  title: string;
  price: number;
  qty: number;
  sellerId: string;
  lineTotal: number;
  image?: string;
  status?: OrderItemStatus;
}

export interface Order {
  id: string;
  buyerId: string;
  buyerEmail: string;
  contactId: string;
  shippingAddressId: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  items: OrderItem[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  role: Role;
  phone?: string;
  address?: string;
}

export interface Contact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email?: string;
  createdAt: string;
}

export interface Address {
  id: string;
  userId: string;
  coords: {
    lat: number;
    lon: number;
  } | null;
  addressText: string;
  apartment?: string;
  floor?: string;
  label?: string;
  isFavorite?: boolean;
  courierComment?: string;
  createdAt: string;
}

export interface SellerProfile {
  id: string;
  status: string;
  storeName: string;
  phone: string;
  city: string;
  referenceCategory: string;
  catalogPosition: string;
}

export interface CustomPrintRequest {
  id: string;
  name: string;
  contact: string;
  comment: string;
  status: 'new' | 'in_review' | 'quoted';
}
