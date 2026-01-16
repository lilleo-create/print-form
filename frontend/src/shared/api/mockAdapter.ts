import { products } from './mockData';
import { ApiClient } from './client';
import { CustomPrintRequest, Product } from '../types';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const createMockClient = (): ApiClient => {
  return {
    async request<T>(path: string, options = {}) {
      await delay(400);

      if (path.startsWith('/products')) {
        if (path === '/products') {
          return { data: products as T };
        }
        const id = path.split('/')[2];
        const product = products.find((item) => item.id === id);
        if (!product) {
          throw new Error('Product not found');
        }
        return { data: product as T };
      }

      if (path === '/custom-requests' && options.method === 'POST') {
        const payload = options.body as CustomPrintRequest;
        return { data: { ...payload, id: 'cr-1', status: 'new' } as T };
      }

      if (path === '/me/orders') {
        return { data: orders as T };
      }

      if (path === '/seller/products') {
        return { data: products as T };
      }

      if (path === '/seller/orders') {
        return { data: orders as T };
      }

      if (path === '/auth/login' || path === '/auth/register') {
        return { data: { token: 'mock-token', user: { name: 'Алина', role: 'buyer' } } as T };
      }

      if (path === '/orders' && options.method === 'POST') {
        return { data: { success: true } as T };
      }

      if (path === '/filters') {
        const categories = Array.from(new Set(products.map((item) => item.category)));
        const materials = Array.from(new Set(products.map((item) => item.material)));
        const sizes = Array.from(new Set(products.map((item) => item.size)));
        return { data: { categories, materials, sizes } as T };
      }

      throw new Error(`Mock endpoint not found: ${path}`);
    }
  };
};

export const filterProducts = (
  items: Product[],
  filters: { category?: string; material?: string; price?: string; size?: string }
) => {
  return items.filter((item) => {
    const matchCategory = filters.category ? item.category === filters.category : true;
    const matchMaterial = filters.material ? item.material === filters.material : true;
    const matchSize = filters.size ? item.size === filters.size : true;
    const matchPrice = filters.price
      ? (() => {
        const [min, max] = filters.price.split('-').map(Number);
        return item.price >= min && item.price <= max;
      })()
      : true;
    return matchCategory && matchMaterial && matchSize && matchPrice;
  });
};
