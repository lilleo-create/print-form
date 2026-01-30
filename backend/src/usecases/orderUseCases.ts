import { orderRepository } from '../repositories/orderRepository';
import { userRepository } from '../repositories/userRepository';
import { sheetsService } from '../services/sheetsService';

export const orderUseCases = {
  create: async (data: {
    buyerId: string;
    contactId?: string;
    shippingAddressId?: string;
    items: { productId: string; variantId?: string; quantity: number }[];
  }) => {
    const order = await orderRepository.create(data);
    const buyer = await userRepository.findById(data.buyerId);

    if (buyer) {
      await Promise.all(
        order.items.map(async (item) => {
          try {
            await sheetsService.appendOrderRow({
              orderId: order.id,
              createdAt: order.createdAt.toISOString(),
              userEmail: buyer.email,
              productTitle: item.product.title,
              sku: item.product.sku,
              variant: item.variant?.name ?? '-',
              qty: item.quantity,
              price: item.priceAtPurchase,
              currency: item.currency,
              status: order.status
            });
          } catch (error) {
            console.warn('Sheets append failed', error);
          }
        })
      );
    }

    return order;
  },
  listByBuyer: orderRepository.findByBuyer,
  get: orderRepository.findById,
  listBySeller: orderRepository.findSellerOrders
};
