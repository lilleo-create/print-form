export type MaterialType = 'PLA' | 'ABS' | 'PETG' | 'RESIN';
export type TechnologyType = 'FDM' | 'SLA';

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

export interface Order {
  id: string;
  status: 'processing' | 'printing' | 'shipped' | 'delivered';
  total: number;
  createdAt: string;
  items: CartItem[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'buyer' | 'seller';
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
