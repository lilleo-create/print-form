import { orderRepository } from '../repositories/orderRepository';

export const orderUseCases = {
  create: orderRepository.create,
  listByBuyer: orderRepository.findByBuyer,
  get: orderRepository.findById,
  listBySeller: orderRepository.findSellerOrders
};
