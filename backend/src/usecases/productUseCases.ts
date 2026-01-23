import { productRepository } from '../repositories/productRepository';

export const productUseCases = {
  list: (filters: {
    category?: string;
    material?: string;
    size?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: 'createdAt' | 'rating';
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) => productRepository.findMany(filters),
  get: (id: string) => productRepository.findById(id),
  create: productRepository.create,
  update: productRepository.update,
  remove: productRepository.remove
};
