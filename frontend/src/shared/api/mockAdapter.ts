import { products, orders } from './mockData';
import { ApiClient } from './client';
import { CustomPrintRequest, Product } from '../types';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
type RequestOptions = { method?: string; body?: unknown };
export const createMockClient = (): ApiClient => {
  return {
    async request<T>(path: string, options: RequestOptions = {}) {
      await delay(400);

      if (path.startsWith('/products')) {
        const [pathname, queryString] = path.split('?');
        if (pathname === '/products') {
          const params = new URLSearchParams(queryString ?? '');
          const filters = {
            category: params.get('category') ?? undefined,
            material: params.get('material') ?? undefined,
            size: params.get('size') ?? undefined,
            minPrice: params.get('minPrice') ? Number(params.get('minPrice')) : undefined,
            maxPrice: params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined,
            q: params.get('q') ?? undefined,
            ratingMin: params.get('ratingMin') ? Number(params.get('ratingMin')) : undefined,
            color: params.get('color') ?? undefined,
            sort: params.get('sort') ?? undefined,
            order: params.get('order') ?? undefined,
            cursor: params.get('cursor') ?? undefined,
            limit: params.get('limit') ? Number(params.get('limit')) : undefined
          };
          let items = filterProducts(products, filters);
          if (filters.sort === 'rating') {
            items = [...items].sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0));
          } else if (filters.sort === 'createdAt') {
            items = [...items].sort((a, b) => (b.id ?? '').localeCompare(a.id ?? ''));
          }
          if (filters.order === 'asc') {
            items = [...items].reverse();
          }
          if (filters.cursor) {
            const cursorIndex = items.findIndex((item) => item.id === filters.cursor);
            if (cursorIndex >= 0) {
              items = items.slice(cursorIndex + 1);
            }
          }
          if (filters.limit) {
            items = items.slice(0, filters.limit);
          }
          return { data: items as T };
        }
        const id = pathname.split('/')[2];
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
        const colors = Array.from(new Set(products.map((item) => item.color)));
        return { data: { categories, materials, sizes, colors } as T };
      }

      throw new Error(`Mock endpoint not found: ${path}`);
    }
  };
};

export const filterProducts = (
  items: Product[],
  filters: {
    category?: string;
    material?: string;
    size?: string;
    minPrice?: number;
    maxPrice?: number;
    q?: string;
    ratingMin?: number;
    color?: string;
  }
) => {
  return items.filter((item) => {
    const matchCategory = filters.category ? item.category === filters.category : true;
    const matchMaterial = filters.material ? item.material === filters.material : true;
    const matchSize = filters.size ? item.size === filters.size : true;
    const matchPrice =
      filters.minPrice !== undefined || filters.maxPrice !== undefined
        ? item.price >= (filters.minPrice ?? 0) && item.price <= (filters.maxPrice ?? Number.MAX_SAFE_INTEGER)
        : true;
    const matchQuery = filters.q
      ? item.title.toLowerCase().includes(filters.q.toLowerCase()) ||
        item.description.toLowerCase().includes(filters.q.toLowerCase())
      : true;
    const matchRating = filters.ratingMin ? (item.ratingAvg ?? 0) >= filters.ratingMin : true;
    const matchColor = filters.color ? item.color.toLowerCase() === filters.color.toLowerCase() : true;
    return matchCategory && matchMaterial && matchSize && matchPrice && matchQuery && matchRating && matchColor;
  });
};
