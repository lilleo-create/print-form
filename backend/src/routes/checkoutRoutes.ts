import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/authMiddleware';
import { writeLimiter } from '../middleware/rateLimiters';
import { prisma } from '../lib/prisma';

export const checkoutRoutes = Router();

const recipientSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(5),
  email: z.string().email()
});

const addressSchema = z.object({
  line1: z.string().min(3),
  city: z.string().min(2),
  postalCode: z.string().min(2),
  country: z.string().min(2),
  apartment: z.string().optional(),
  floor: z.string().optional(),
  comment: z.string().optional()
});

const pickupSchema = z.object({
  pickupPointId: z.string().min(1),
  provider: z.enum(['CDEK', 'YANDEX'])
});

const deliveryMethodSchema = z.object({
  methodCode: z.enum(['ADDRESS', 'PICKUP']),
  subType: z.string().optional()
});

const paymentMethodSchema = z.object({
  methodCode: z.enum(['CARD', 'SBP']),
  cardId: z.string().optional()
});

const cardSchema = z.object({
  cardNumber: z.string().min(12),
  expMonth: z.union([z.string(), z.number()]),
  expYear: z.union([z.string(), z.number()]),
  cvv: z.string().min(3).max(4)
});

let setupPromise: Promise<void> | null = null;

const ensureCheckoutTables = async () => {
  if (!setupPromise) {
    setupPromise = Promise.all([
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS user_checkout_preferences (
          user_id TEXT PRIMARY KEY,
          delivery_method TEXT NOT NULL DEFAULT 'ADDRESS',
          delivery_sub_type TEXT,
          payment_method TEXT NOT NULL DEFAULT 'CARD',
          selected_card_id TEXT,
          pickup_point_id TEXT,
          pickup_provider TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS user_saved_cards (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          brand TEXT NOT NULL,
          last4 TEXT NOT NULL,
          exp_month INT NOT NULL,
          exp_year INT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
    ]).then(() => undefined);
  }
  return setupPromise;
};

type PreferencesRow = {
  user_id: string;
  delivery_method: 'ADDRESS' | 'PICKUP';
  delivery_sub_type: string | null;
  payment_method: 'CARD' | 'SBP';
  selected_card_id: string | null;
  pickup_point_id: string | null;
  pickup_provider: 'CDEK' | 'YANDEX' | null;
};

type CardRow = {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
};

const DELIVERY_METHODS = [
  { id: 'address', code: 'ADDRESS', title: 'По адресу', description: 'Курьером до двери' },
  { id: 'pickup', code: 'PICKUP', title: 'В пункт выдачи', description: 'Самовывоз из ПВЗ' }
];

const PAYMENT_METHODS = [
  { id: 'card', code: 'CARD', title: 'Банковской картой' },
  { id: 'sbp', code: 'SBP', title: 'СБП' }
];

const getBrand = (cardNumber: string) => {
  if (cardNumber.startsWith('4')) return 'VISA';
  if (cardNumber.startsWith('5')) return 'Mastercard';
  if (cardNumber.startsWith('2')) return 'МИР';
  return 'CARD';
};

const pickupPoints = [
  {
    id: 'cdek-1',
    provider: 'CDEK',
    address: 'Москва, Поликарпова, 23А к38',
    lat: 55.754,
    lng: 37.556,
    title: 'СДЭК Поликарпова',
    workHours: '09:00–21:00'
  },
  {
    id: 'ya-1',
    provider: 'YANDEX',
    address: 'Москва, Ленинградский проспект, 31',
    lat: 55.782,
    lng: 37.576,
    title: 'Яндекс Маркет ПВЗ',
    workHours: '10:00–22:00'
  }
] as const;

const getCheckoutData = async (userId: string) => {
  await ensureCheckoutTables();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const contact = await prisma.contact.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
  const defaultAddress = await prisma.address.findFirst({ where: { userId, isDefault: true } });

  const prefsRows = await prisma.$queryRawUnsafe<PreferencesRow[]>(
    'SELECT * FROM user_checkout_preferences WHERE user_id = $1 LIMIT 1',
    userId
  );
  const prefs = prefsRows[0];

  const cards = await prisma.$queryRawUnsafe<CardRow[]>(
    `SELECT id, brand, last4, exp_month, exp_year
     FROM user_saved_cards
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    userId
  );

  const products = await prisma.product.findMany({
    take: 4,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      price: true,
      image: true,
      descriptionShort: true,
      sku: true,
      deliveryDateEstimated: true
    }
  });

  const selectedPickup = prefs?.pickup_point_id
    ? pickupPoints.find((point) => point.id === prefs.pickup_point_id)
    : null;

  return {
    recipient: {
      name: contact?.name ?? user?.name ?? '',
      phone: contact?.phone ?? user?.phone ?? '',
      email: contact?.email ?? user?.email ?? ''
    },
    address: defaultAddress
      ? {
          line1: defaultAddress.addressText,
          city: 'Москва',
          postalCode: '125040',
          country: 'Россия',
          apartment: defaultAddress.apartment ?? null,
          floor: defaultAddress.floor ?? null,
          comment: defaultAddress.courierComment ?? null
        }
      : null,
    selectedPickupPoint: selectedPickup ?? null,
    selectedDeliveryMethod: prefs?.delivery_method ?? 'ADDRESS',
    selectedDeliverySubType: prefs?.delivery_sub_type ?? null,
    selectedPaymentMethod: prefs?.payment_method ?? 'CARD',
    selectedCardId: prefs?.selected_card_id ?? null,
    deliveryMethods: DELIVERY_METHODS,
    paymentMethods: PAYMENT_METHODS,
    savedCards: cards.map((card) => ({
      id: card.id,
      brand: card.brand,
      last4: card.last4,
      expMonth: card.exp_month,
      expYear: card.exp_year
    })),
    cartItems: products.map((item, index) => ({
      productId: item.id,
      title: item.title,
      price: item.price,
      quantity: 1,
      image: item.image,
      shortSpec: item.descriptionShort || item.sku,
      deliveryDate: item.deliveryDateEstimated?.toISOString() ?? null,
      deliveryEtaDays: item.deliveryDateEstimated ? null : index + 1
    }))
  };
};

checkoutRoutes.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const data = await getCheckoutData(req.user!.userId);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

checkoutRoutes.put('/recipient', requireAuth, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = recipientSchema.parse(req.body);
    const existing = await prisma.contact.findFirst({ where: { userId: req.user!.userId }, orderBy: { createdAt: 'desc' } });

    if (existing) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: { name: payload.name, phone: payload.phone, email: payload.email }
      });
    } else {
      await prisma.contact.create({
        data: { userId: req.user!.userId, name: payload.name, phone: payload.phone, email: payload.email }
      });
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

checkoutRoutes.put('/address', requireAuth, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = addressSchema.parse(req.body);
    const existing = await prisma.address.findFirst({ where: { userId: req.user!.userId, isDefault: true } });

    if (existing) {
      await prisma.address.update({
        where: { id: existing.id },
        data: {
          addressText: payload.line1,
          apartment: payload.apartment,
          floor: payload.floor,
          courierComment: payload.comment
        }
      });
    } else {
      await prisma.address.create({
        data: {
          userId: req.user!.userId,
          addressText: payload.line1,
          apartment: payload.apartment,
          floor: payload.floor,
          courierComment: payload.comment,
          isDefault: true
        }
      });
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

checkoutRoutes.put('/pickup', requireAuth, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = pickupSchema.parse(req.body);
    await ensureCheckoutTables();
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO user_checkout_preferences (user_id, pickup_point_id, pickup_provider, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET pickup_point_id = EXCLUDED.pickup_point_id,
          pickup_provider = EXCLUDED.pickup_provider,
          delivery_method = 'PICKUP',
          updated_at = NOW()
      `,
      req.user!.userId,
      payload.pickupPointId,
      payload.provider
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

checkoutRoutes.put('/delivery-method', requireAuth, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = deliveryMethodSchema.parse(req.body);
    await ensureCheckoutTables();
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO user_checkout_preferences (user_id, delivery_method, delivery_sub_type, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET delivery_method = EXCLUDED.delivery_method,
          delivery_sub_type = EXCLUDED.delivery_sub_type,
          updated_at = NOW()
      `,
      req.user!.userId,
      payload.methodCode,
      payload.subType ?? null
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

checkoutRoutes.put('/payment-method', requireAuth, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = paymentMethodSchema.parse(req.body);
    await ensureCheckoutTables();
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO user_checkout_preferences (user_id, payment_method, selected_card_id, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET payment_method = EXCLUDED.payment_method,
          selected_card_id = EXCLUDED.selected_card_id,
          updated_at = NOW()
      `,
      req.user!.userId,
      payload.methodCode,
      payload.cardId ?? null
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

checkoutRoutes.get('/pickup-points', requireAuth, async (req, res) => {
  const provider = typeof req.query.provider === 'string' ? req.query.provider : undefined;
  const items = provider ? pickupPoints.filter((point) => point.provider === provider) : pickupPoints;
  res.json({ items });
});

checkoutRoutes.get('/cards', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await ensureCheckoutTables();
    const cards = await prisma.$queryRawUnsafe<CardRow[]>(
      `SELECT id, brand, last4, exp_month, exp_year FROM user_saved_cards WHERE user_id = $1 ORDER BY created_at DESC`,
      req.user!.userId
    );

    res.json({
      items: cards.map((card) => ({
        id: card.id,
        brand: card.brand,
        last4: card.last4,
        expMonth: card.exp_month,
        expYear: card.exp_year
      }))
    });
  } catch (error) {
    next(error);
  }
});

checkoutRoutes.post('/cards', requireAuth, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = cardSchema.parse(req.body);
    await ensureCheckoutTables();

    const number = payload.cardNumber.replace(/\s+/g, '');
    const month = Number(payload.expMonth);
    const year = Number(payload.expYear);
    const id = `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO user_saved_cards (id, user_id, brand, last4, exp_month, exp_year)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      id,
      req.user!.userId,
      getBrand(number),
      number.slice(-4),
      month,
      year
    );

    res.status(201).json({
      id,
      brand: getBrand(number),
      last4: number.slice(-4),
      expMonth: month,
      expYear: year
    });
  } catch (error) {
    next(error);
  }
});
