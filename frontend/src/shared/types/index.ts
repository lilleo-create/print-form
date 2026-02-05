export type MaterialType = 'PLA' | 'ABS' | 'PETG' | 'RESIN';
export type TechnologyType = 'FDM' | 'SLA';
export type Role = 'buyer' | 'seller' | 'admin';
export type OrderStatus = 'CREATED' | 'PRINTING' | 'HANDED_TO_DELIVERY' | 'IN_TRANSIT' | 'DELIVERED';
export type ProductModerationStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_EDIT' | 'ARCHIVED';
export type ReviewModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_EDIT';
export type ReturnStatus = 'CREATED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'REFUNDED';
export type ReturnReason = 'NOT_FIT' | 'DAMAGED' | 'WRONG_ITEM';
export type ChatThreadKind = 'SUPPORT' | 'SELLER';
export type ChatThreadStatus = 'ACTIVE' | 'CLOSED';
export type ChatMessageAuthorRole = 'USER' | 'ADMIN';

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
  createdAt?: string;
  updatedAt?: string;
  images?: ProductImage[];
  variants?: ProductVariant[];
  specs?: ProductSpec[];
  deliveryDateNearest?: string;
  deliveryDateEstimated?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  moderationStatus?: ProductModerationStatus;
  moderationNotes?: string | null;
  publishedAt?: string | null;
  moderatedAt?: string | null;
  moderatedById?: string | null;
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
  isPublic?: boolean;
  moderationStatus?: ReviewModerationStatus;
  moderationNotes?: string | null;
  moderatedAt?: string | null;
  moderatedById?: string | null;
  createdAt: string;
  user?: { id: string; name: string } | null;
  product?: { id: string; title: string; image?: string };
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderItem {
  id?: string;
  productId: string;
  title: string;
  price: number;
  qty: number;
  sellerId: string;
  lineTotal: number;
  image?: string;
}

export interface ReturnPhoto {
  id: string;
  url: string;
  createdAt?: string;
}

export interface ReturnItem {
  id: string;
  orderItemId: string;
  quantity: number;
  orderItem?: {
    id: string;
    quantity: number;
    priceAtPurchase: number;
    productId: string;
    product?: Product | null;
    order?: { id: string; createdAt: string; statusUpdatedAt?: string | null; status?: OrderStatus } | null;
  } | null;
}

export interface ReturnRequest {
  id: string;
  userId?: string;
  status: ReturnStatus;
  reason: ReturnReason;
  comment?: string | null;
  adminComment?: string | null;
  createdAt: string;
  updatedAt?: string;
  items: ReturnItem[];
  photos: ReturnPhoto[];
  chatThread?: { id: string; status: ChatThreadStatus } | null;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  authorRole: ChatMessageAuthorRole;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface ChatThread {
  id: string;
  kind: ChatThreadKind;
  userId: string;
  status: ChatThreadStatus;
  returnRequestId?: string | null;
  lastMessageAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  lastMessage?: ChatMessage | null;
  returnRequest?: ReturnRequest | null;
  user?: { id: string; name: string; email: string } | null;
}

export interface Order {
  id: string;
  buyerId: string;
  buyerEmail: string;
  contactId: string;
  shippingAddressId: string;
  status: OrderStatus;
  statusUpdatedAt?: string;
  total: number;
  createdAt: string;
  trackingNumber?: string | null;
  carrier?: string | null;
  contact?: Contact | null;
  shippingAddress?: Address | null;
  buyer?: { id: string; name: string; email: string; phone?: string | null } | null;
  items: OrderItem[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  role: Role;
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

export interface SellerContextResponse {
  isSeller: boolean;
  profile: SellerProfile | null;
  kyc?: SellerKycSubmission | null;
  canSell?: boolean;
}

export type KycStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SellerDocument {
  id: string;
  submissionId: string;
  type: string;
  url: string;
  fileName?: string | null;
  originalName: string;
  mime: string;
  size: number;
  createdAt: string;
}

export interface SellerKycSubmission {
  id: string;
  userId: string;
  status: KycStatus;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewerId?: string | null;
  moderationNotes?: string | null;
  notes?: string | null;
  documents: SellerDocument[];
  user?: { id: string; name: string; email: string; phone?: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface PaymentIntent {
  id: string;
  status: string;
  provider: string;
  amount: number;
  currency: string;
  clientSecret?: string;
}

export interface Payment {
  id: string;
  orderId: string;
  status: string;
  amount: number;
  currency: string;
  createdAt: string;
}

export interface CustomPrintRequest {
  id: string;
  name: string;
  contact: string;
  comment: string;
  status: 'new' | 'in_review' | 'quoted';
}
