import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/authMiddleware';
import { productUseCases } from '../usecases/productUseCases';
import { orderUseCases } from '../usecases/orderUseCases';
import { sellerProductSchema } from './productRoutes';

export const sellerRoutes = Router();

sellerRoutes.use(authenticate, authorize(['SELLER', 'ADMIN']));

sellerRoutes.get('/products', async (req: AuthRequest, res, next) => {
  try {
    const products = await productUseCases.list({});
    const sellerProducts = products.filter((product) => product.sellerId === req.user?.userId);
    res.json({ data: sellerProducts });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.post('/products', async (req: AuthRequest, res, next) => {
  try {
    const payload = sellerProductSchema.parse(req.body);
    const product = await productUseCases.create({
      ...payload,
      sellerId: req.user!.userId
    });
    res.status(201).json({ data: product });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.put('/products/:id', async (req: AuthRequest, res, next) => {
  try {
    const payload = sellerProductSchema.partial().parse(req.body);
    const product = await productUseCases.update(req.params.id, {
      ...payload,
      sellerId: req.user!.userId
    });
    res.json({ data: product });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.delete('/products/:id', async (req: AuthRequest, res, next) => {
  try {
    await productUseCases.remove(req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.get('/orders', async (req: AuthRequest, res, next) => {
  try {
    const orders = await orderUseCases.listBySeller(req.user!.userId);
    res.json({ data: orders });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    const orders = await orderUseCases.listBySeller(req.user!.userId);
    const revenue = orders.reduce((sum, order) => sum + order.total, 0);
    res.json({ data: { revenue, orders: orders.length } });
  } catch (error) {
    next(error);
  }
});
