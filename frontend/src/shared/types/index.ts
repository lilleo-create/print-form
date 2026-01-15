export type MaterialType = 'PLA' | 'ABS' | 'PETG' | 'RESIN';
export type TechnologyType = 'FDM' | 'SLA';
export type Role = 'buyer' | 'seller';
export type OrderStatus = 'processing' | 'printing' | 'shipped' | 'delivered';

export interface Product {
  id: string;
  title: string;
  category: string;
  price: number;
  image: string;
  description: string;
  material: MaterialType;
  size: string;
  technology: TechnologyType;
  printTime: string;
  color: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
}

export interface Order {
  id: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  items: OrderItem[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface SellerProfile {
  id: string;
  shopName: string;
  rating: number;
  totalSales: number;
}

export interface CustomPrintRequest {
  id: string;
  name: string;
  contact: string;
  comment: string;
  status: 'new' | 'in_review' | 'quoted';
}
