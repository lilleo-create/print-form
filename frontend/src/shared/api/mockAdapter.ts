import { products, orders, reviews } from './mockData';
import { ApiClient } from './client';
import { CustomPrintRequest, Product } from '../types';
import { loadFromStorage } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';
import type { MaterialType, TechnologyType } from '@/shared/types'; // путь подстрой

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
type RequestOptions = { method?: string; body?: unknown };
let mockReviews = [...reviews];
export const createMockClient = (): ApiClient => {
  return {
    async request<T>(path: string, options: RequestOptions = {}) {
      await delay(400);

      if (path.startsWith('/products')) {
        const [pathname, queryString] = path.split('?');
        if (pathname.endsWith('/reviews/summary')) {
          const productId = pathname.split('/')[2];
          const params = new URLSearchParams(queryString ?? '');
          const scopedIds = params.get('productIds')
            ? params
              .get('productIds')!
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
            : [productId];
          const productReviews = mockReviews.filter(
            (review) => !!review.productId && scopedIds.includes(review.productId) && review.isPublic !== false
          );
          const total = productReviews.length;
          const counts = [5, 4, 3, 2, 1].map((rating) => ({
            rating,
            count: productReviews.filter((review) => review.rating === rating).length
          }));
          const avg = total
            ? productReviews.reduce((sum, review) => sum + review.rating, 0) / total
            : 0;
          const photos = productReviews.flatMap((review) => review.photos ?? []);
          return { data: { total, avg, counts, photos } as T };
        }
        if (pathname.includes('/reviews')) {
          const productId = pathname.split('/')[2];
          if (options.method === 'POST') {
            const payload = options.body as {
              rating: number;
              pros: string;
              cons: string;
              comment: string;
              photos?: string[];
            };
            const newReview = {
              id: `review-${Date.now()}`,
              productId,
              userId: 'buyer-1',
              rating: payload.rating,
              pros: payload.pros,
              cons: payload.cons,
              comment: payload.comment,
              photos: payload.photos ?? [],
              likesCount: 0,
              dislikesCount: 0,
              isPublic: true,
              createdAt: new Date().toISOString(),
              user: { id: 'buyer-1', name: 'Гость' }
            };
            mockReviews = [newReview, ...mockReviews];
            return { data: newReview as T };
          }
          const params = new URLSearchParams(queryString ?? '');
          const scopedIds = params.get('productIds')
            ? params
              .get('productIds')!
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
            : [productId];
          const page = params.get('page') ? Number(params.get('page')) : 1;
          const limit = params.get('limit') ? Number(params.get('limit')) : 5;
          const sort = params.get('sort') ?? 'new';
          const productReviews = mockReviews.filter(
            (review) => {
              const pid = review.productId;
              return typeof pid === 'string' && scopedIds.includes(pid) && review.isPublic !== false;
            }
          );
          const sorted = [...productReviews].sort((a, b) => {
            if (sort === 'helpful') {
              return (b.likesCount ?? 0) - (a.likesCount ?? 0);
            }
            if (sort === 'high') {
              return b.rating - a.rating;
            }
            if (sort === 'low') {
              return a.rating - b.rating;
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          const data = sorted.slice((page - 1) * limit, page * limit);
          return { data: { data, meta: { total: productReviews.length } } as T };
        }
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
          const withRatings = items.map((item) => {
            const productReviews = mockReviews.filter(
              (review) => review.productId === item.id && review.isPublic !== false
            );
            const ratingCount = productReviews.length;
            const ratingAvg = ratingCount
              ? productReviews.reduce((sum, review) => sum + review.rating, 0) / ratingCount
              : 0;
            return { ...item, ratingAvg, ratingCount };
          });
          return { data: withRatings as T };
        }
        const id = pathname.split('/')[2];
        const product = products.find((item) => item.id === id);
        if (!product) {
          throw new Error('Product not found');
        }
        const productReviews = mockReviews.filter((review) => review.productId === id && review.isPublic !== false);
        const ratingCount = productReviews.length;
        const ratingAvg = ratingCount
          ? productReviews.reduce((sum, review) => sum + review.rating, 0) / ratingCount
          : 0;
        return { data: { ...product, ratingAvg, ratingCount } as T };
      }

      if (path === '/custom-requests' && options.method === 'POST') {
        const payload = options.body as CustomPrintRequest;
        return { data: { ...payload, id: 'cr-1', status: 'new' } as T };
      }

      if (path === '/me/orders') {
        return { data: orders as T };
      }

      if (path === '/seller/products') {
        if (options.method === 'POST') {
          const payload = options.body as {
            title: string;
            price: number;
            material: string;
            category: string;
            size: string;
            technology: string;
            printTime: string;
            color: string;
            description: string;
            imageUrls: string[];
            deliveryDateEstimated?: string;
            deliveryDates?: string[];
          };
          const created = {
            id: `seller-${Date.now()}`,
            title: payload.title,
            category: payload.category,
            price: payload.price,
            image: payload.imageUrls[0],
            description: payload.description,
            material: payload.material as MaterialType,
            size: payload.size,
            technology: payload.technology as TechnologyType,
            printTime: payload.printTime,
            color: payload.color,
            sellerId: 'seller-1',
            images: payload.imageUrls.map((url, index) => ({ id: `img-${index}`, url, sortOrder: index })),
            deliveryDateEstimated: payload.deliveryDateEstimated,
            deliveryDates: payload.deliveryDates ?? []
          };
          products.unshift(created);
          return { data: created as T };
        }
        return { data: products as T };
      }

      if (path.startsWith('/seller/products/') && options.method === 'PUT') {
        const id = path.split('/')[3];
        const payload = options.body as Partial<{
          title: string;
          price: number;
          material: string;
          category: string;
          size: string;
          technology: string;
          printTime: string;
          color: string;
          description: string;
          imageUrls: string[];
          deliveryDateEstimated?: string;
          deliveryDates?: string[];
        }>;

        const index = products.findIndex((product) => product.id === id);
        if (index === -1) {
          throw new Error('Product not found');
        }

        const nextImages = payload.imageUrls?.map((url, indexValue) => ({
          id: `${products[index].id}-img-${indexValue}`,
          url,
          sortOrder: indexValue
        }));

        const updated: Product = {
          ...products[index],
          ...payload,
          material: (payload.material ?? products[index].material) as MaterialType,
          technology: (payload.technology ?? products[index].technology) as TechnologyType,
          image: payload.imageUrls?.[0] ?? products[index].image,
          images: nextImages ?? products[index].images
        };

        products[index] = updated;
        return { data: updated as T };
      }

      if (path === '/seller/orders') {
        return { data: orders as T };
      }

      if (path === '/seller/me') {
        const session = loadFromStorage<{ user?: { role?: string } } | null>(STORAGE_KEYS.session, null);
        const isSeller = session?.user?.role === 'seller';
        return {
          data: {
            isSeller,
            profile: isSeller
              ? {
                id: 'seller-profile-1',
                status: 'ИП',
                storeName: 'PrintForm',
                phone: '+7 (900) 555-11-22',
                city: 'Москва',
                referenceCategory: 'Гаджеты',
                catalogPosition: 'Премиум'
              }
              : null
          } as T
        };
      }

      if (path === '/seller/stats') {
        return {
          data: {
            totalOrders: orders.length,
            totalRevenue: orders.reduce((sum, order) => sum + order.total, 0),
            totalProducts: products.length,
            averageRating:
              products.reduce((sum, product) => sum + (product.ratingAvg ?? 0), 0) /
              Math.max(products.length, 1)
          } as T
        };
      }

      if (path === '/seller/onboarding' && options.method === 'POST') {
        const payload = options.body as {
          name: string;
          phone: string;
          status: string;
          storeName: string;
          city: string;
          referenceCategory: string;
          catalogPosition: string;
        };
        return {
          data: {
            data: {
              id: 'seller-1',
              name: payload.name,
              email: 'seller@test.com',
              phone: payload.phone,
              role: 'seller'
            }
          } as T
        };
      }

      if (path === '/auth/login' || path === '/auth/register') {
        return {
          data: {
            token: 'mock-token',
            user: {
              id: 'buyer-1',
              name: 'Алина',
              role: 'buyer',
              email: 'buyer@test.com',
              phone: '+7 (900) 123-45-67',
              address: 'Москва, ул. Тверская, 12'
            }
          } as T
        };
      }

      if (path === '/me/reviews') {
        const reviewsByUser = mockReviews
          .filter((review) => review.userId === 'buyer-1')
          .map((review) => ({
            ...review,
            product: products.find((product) => product.id === review.productId)
          }));
        return { data: { data: reviewsByUser } as T };
      }

      if (path.startsWith('/me/reviews/') && path.endsWith('/visibility') && options.method === 'PATCH') {
        const id = path.split('/')[3];
        const payload = options.body as { isPublic: boolean };
        mockReviews = mockReviews.map((review) =>
          review.id === id ? { ...review, isPublic: payload.isPublic } : review
        );
        const updated = mockReviews.find((review) => review.id === id);
        return { data: { data: updated } as T };
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
