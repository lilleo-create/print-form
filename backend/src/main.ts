import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { authRoutes } from './routes/authRoutes';
import { productRoutes } from './routes/productRoutes';
import { orderRoutes } from './routes/orderRoutes';
import { customRequestRoutes } from './routes/customRequestRoutes';
import { sellerRoutes } from './routes/sellerRoutes';
import { filterRoutes } from './routes/filterRoutes';
import { meRoutes } from './routes/meRoutes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(
  cors({
    origin: env.frontendOrigin,
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/custom-requests', customRequestRoutes);
app.use('/seller', sellerRoutes);
app.use('/filters', filterRoutes);
app.use('/me', meRoutes);

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`API running on ${env.port}`);
});
