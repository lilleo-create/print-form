import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
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
const uploadsDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(uploadsDir));

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
