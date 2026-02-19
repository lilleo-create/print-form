import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/authMiddleware';
import { writeLimiter } from '../middleware/rateLimiters';
import { prisma } from '../lib/prisma';
import { yandexDeliveryService } from '../services/yandexDeliveryService';
import { resolvePlatformStationIdByPickupPointId } from '../services/yandexNdd/resolvePlatformStationIdByPickupPointId';
import { looksLikeDigits, looksLikePvzId } from '../services/yandexNdd/nddIdSemantics';

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

const pickupPointSchema = z.object({
  id: z.string().min(1),
  buyerPickupPointId: z.string().optional(),
  buyerPickupPlatformStationId: z.string().regex(/^\d+$/).nullable().optional(),
  buyerPickupOperatorStationId: z.string().regex(/^\d+$/).nullable().optional(),
  operator_station_id: z.string().regex(/^\d+$/).nullable().optional(),
  fullAddress: z.string().min(1),
  country: z.string().optional(),
  locality: z.string().optional(),
  street: z.string().optional(),
  house: z.string().optional(),
  comment: z.string().optional(),
  position: z
    .object({
      lat: z.number().optional(),
      lng: z.number().optional()
    })
    .passthrough()
    .optional(),
  type: z.string().optional(),
  paymentMethods: z.array(z.string()).optional()
});

const pickupSchema = z.object({
  pickupPoint: pickupPointSchema,
  provider: z.string().min(1)
});

const deliveryMethodSchema = z.object({
  methodCode: z.enum(['ADDRESS', 'PICKUP', 'COURIER', 'PICKUP_POINT']),
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

type PreferencesRow = {
  user_id: string;
  delivery_method: 'ADDRESS' | 'PICKUP' | 'COURIER' | 'PICKUP_POINT';
  delivery_sub_type: string | null;
  delivery_provider: string | null;
  payment_method: 'CARD' | 'SBP';
  selected_card_id: string | null;
  pickup_point_id: string | null;
  pickup_provider: string | null;
  pickup_point_json: unknown;
};

type CardRow = {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
};

const DELIVERY_METHODS = [
  { id: 'courier', code: 'COURIER', title: 'Курьером', description: 'Курьером до двери' },
  { id: 'pickup_point', code: 'PICKUP_POINT', title: 'Самовывоз', description: 'Пункт выдачи или постамат' }
] as const;

const PAYMENT_METHODS = [
  { id: 'card', code: 'CARD', title: 'Банковской картой' },
  { id: 'sbp', code: 'SBP', title: 'СБП' }
] as const;

let setupPromise: Promise<void> | null = null;

const ensureCheckoutTables = async () => {
  if (!setupPromise) {
    setupPromise = (async () => {
      // ✅ строго последовательно, никаких Promise.all
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS user_checkout_preferences (
          user_id TEXT PRIMARY KEY,
          delivery_method TEXT NOT NULL DEFAULT 'COURIER',
          delivery_sub_type TEXT,
          delivery_provider TEXT,
          payment_method TEXT NOT NULL DEFAULT 'CARD',
          selected_card_id TEXT,
          pickup_point_id TEXT,
          pickup_provider TEXT,
          pickup_point_json JSONB,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE user_checkout_preferences
          ADD COLUMN IF NOT EXISTS delivery_provider TEXT,
          ADD COLUMN IF NOT EXISTS pickup_point_json JSONB
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS user_saved_cards (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          brand TEXT NOT NULL,
          last4 TEXT NOT NULL,
          exp_month INT NOT NULL,
          exp_year INT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    })().then(() => undefined);
  }

  return setupPromise;
};

const normalizeDeliveryMethod = (method: PreferencesRow['delivery_method'] | undefined | null) => {
  if (method === 'ADDRESS') return 'COURIER';
  if (method === 'PICKUP') return 'PICKUP_POINT';
  return method ?? 'COURIER';
};

const getBrand = (cardNumber: string) => {
  if (cardNumber.startsWith('4')) return 'VISA';
  if (cardNumber.startsWith('5')) return 'Mastercard';
  if (cardNumber.startsWith('2')) return 'МИР';
  return 'CARD';
};


const resolveDeliveryDaysFromOffer = (offer: Record<string, unknown> | null): number | null => {
  if (!offer) return null;

  const direct = offer.delivery_days;
  if (typeof direct === 'number' && Number.isFinite(direct) && direct >= 0) {
    return Math.ceil(direct);
  }

  const delivery = offer.delivery;
  if (delivery && typeof delivery === 'object' && !Array.isArray(delivery)) {
    const days = (delivery as Record<string, unknown>).days;
    if (typeof days === 'number' && Number.isFinite(days) && days >= 0) {
      return Math.ceil(days);
    }
  }

  return null;
};

const computeDropoffLagDays = (dropoffSchedule: 'DAILY' | 'WEEKDAYS' | null | undefined) =>
  dropoffSchedule === 'WEEKDAYS' ? 1 : 0;

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
      sellerId: true,
      weightGrossG: true,
      dxCm: true,
      dyCm: true,
      dzCm: true
    }
  });

  const parsedPickupPoint = pickupPointSchema.safeParse(prefs?.pickup_point_json);

  const selectedPickupPointId = parsedPickupPoint.success ? parsedPickupPoint.data.id : null;
  const sellerIds = Array.from(new Set(products.map((item) => item.sellerId).filter((value): value is string => Boolean(value))));
  const deliveryProfiles = sellerIds.length
    ? await prisma.sellerDeliveryProfile.findMany({
        where: { sellerId: { in: sellerIds } },
        select: { sellerId: true, dropoffPlatformStationId: true, dropoffSchedule: true }
      })
    : [];
  const profileBySellerId = new Map(deliveryProfiles.map((profile) => [profile.sellerId, profile]));

  const cartItems = await Promise.all(
    products.map(async (item) => {
      const profile = item.sellerId ? profileBySellerId.get(item.sellerId) : null;
      const deliveryDays =
        selectedPickupPointId && profile?.dropoffPlatformStationId
          ? await (async () => {
              try {
                const offersResponse = await yandexDeliveryService.createOffers({
                  station_id: profile.dropoffPlatformStationId,
                  self_pickup_id: selectedPickupPointId,
                  payment_method: 'already_paid',
                  places: [
                    {
                      physical_dims: {
                        dx: item.dxCm ?? 10,
                        dy: item.dyCm ?? 10,
                        dz: item.dzCm ?? 10,
                        weight_gross: item.weightGrossG ?? 100
                      }
                    }
                  ]
                });
                const offersRaw = Array.isArray((offersResponse as Record<string, unknown>).offers)
                  ? ((offersResponse as Record<string, unknown>).offers as Record<string, unknown>[])
                  : [];
                const bestOffer = offersRaw[0] ?? null;
                return resolveDeliveryDaysFromOffer(bestOffer);
              } catch {
                return null;
              }
            })()
          : null;

      const productionDays = 1;
      const dropoffLagDays = computeDropoffLagDays(profile?.dropoffSchedule);
      const etaMinDays = deliveryDays === null ? null : productionDays + dropoffLagDays + deliveryDays;
      const etaMaxDays = etaMinDays === null ? null : etaMinDays + 1;

      return {
        productId: item.id,
        title: item.title,
        price: item.price,
        quantity: 1,
        image: item.image,
        shortSpec: item.descriptionShort || item.sku,
        productionTimeHours: 24,
        deliveryDays,
        etaMinDays,
        etaMaxDays,
        dimensions: item.dxCm && item.dyCm && item.dzCm ? { dxCm: item.dxCm, dyCm: item.dyCm, dzCm: item.dzCm } : null,
        weightGrossG: item.weightGrossG ?? null
      };
    })
  );

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
    selectedPickupPoint: parsedPickupPoint.success ? parsedPickupPoint.data : null,
    selectedDeliveryMethod: normalizeDeliveryMethod(prefs?.delivery_method),
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
    cartItems
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
    const existing = await prisma.contact.findFirst({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' }
    });

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
    const buyerPickupPvzId = payload.pickupPoint.id.trim();
    if (!looksLikePvzId(buyerPickupPvzId)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'pickupPoint.id должен быть pvzId, а не station_id/operator_station_id.'
        }
      });
    }

    const explicitPlatformStationId = payload.pickupPoint.buyerPickupPlatformStationId ?? null;
    const explicitOperatorStationId = payload.pickupPoint.buyerPickupOperatorStationId ?? payload.pickupPoint.operator_station_id ?? null;

    if (explicitPlatformStationId && !looksLikeDigits(explicitPlatformStationId)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'buyerPickupPlatformStationId должен быть station_id платформы (digits).' } });
    }

    if (explicitOperatorStationId && !looksLikeDigits(explicitOperatorStationId)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'buyerPickupOperatorStationId должен быть operator_station_id (digits).' } });
    }

    const resolved = await resolvePlatformStationIdByPickupPointId(buyerPickupPvzId);
    const buyerPickupPlatformStationId = explicitPlatformStationId ?? resolved.platformStationId;
    const buyerPickupOperatorStationId = explicitOperatorStationId ?? resolved.operatorStationId;

    const rawPickupPoint = {
      ...payload.pickupPoint,
      id: buyerPickupPvzId,
      buyerPickupPvzId,
      buyerPickupPlatformStationId,
      buyerPickupOperatorStationId,
      addressFull: payload.pickupPoint.fullAddress
    };

    const pickupPointJson = {
      ...payload.pickupPoint,
      buyerPickupPvzId,
      buyerPickupPlatformStationId,
      buyerPickupOperatorStationId,
      addressFull: payload.pickupPoint.fullAddress,
      raw: rawPickupPoint
    };

    console.info('[CHECKOUT][buyer_pvz_saved]', {
      buyerId: req.user!.userId,
      buyerPickupPvzId,
      buyerPickupOperatorStationId,
      buyerPickupPlatformStationId,
      source_fields: {
        platform: explicitPlatformStationId ? 'payload.pickupPoint.buyerPickupPlatformStationId' : 'resolved.pickup-points/list',
        operator: explicitOperatorStationId ? 'payload.pickupPoint.buyerPickupOperatorStationId|operator_station_id' : 'resolved.pickup-points/list'
      }
    });

    await ensureCheckoutTables();

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO user_checkout_preferences (user_id, pickup_point_id, pickup_provider, pickup_point_json, delivery_provider, updated_at)
        VALUES ($1, $2, $3, $4::jsonb, $3, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET pickup_point_id = EXCLUDED.pickup_point_id,
          pickup_provider = EXCLUDED.pickup_provider,
          pickup_point_json = EXCLUDED.pickup_point_json,
          delivery_provider = EXCLUDED.delivery_provider,
          delivery_method = 'PICKUP_POINT',
          updated_at = NOW()
      `,
      req.user!.userId,
      buyerPickupPvzId,
      payload.provider,
      JSON.stringify(pickupPointJson)
    );

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

checkoutRoutes.put('/delivery-method', requireAuth, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = deliveryMethodSchema.parse(req.body);
    const normalizedMethod = normalizeDeliveryMethod(payload.methodCode);
    await ensureCheckoutTables();

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO user_checkout_preferences (user_id, delivery_method, delivery_sub_type, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET delivery_method = EXCLUDED.delivery_method,
          delivery_sub_type = EXCLUDED.delivery_sub_type,
          pickup_point_id = CASE WHEN EXCLUDED.delivery_method = 'COURIER' THEN NULL ELSE user_checkout_preferences.pickup_point_id END,
          pickup_provider = CASE WHEN EXCLUDED.delivery_method = 'COURIER' THEN NULL ELSE user_checkout_preferences.pickup_provider END,
          pickup_point_json = CASE WHEN EXCLUDED.delivery_method = 'COURIER' THEN NULL ELSE user_checkout_preferences.pickup_point_json END,
          updated_at = NOW()
      `,
      req.user!.userId,
      normalizedMethod,
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

checkoutRoutes.get('/cards', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await ensureCheckoutTables();

    const cards = await prisma.$queryRawUnsafe<CardRow[]>(
      `SELECT id, brand, last4, exp_month, exp_year
       FROM user_saved_cards
       WHERE user_id = $1
       ORDER BY created_at DESC`,
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
