import "dotenv/config";
import { Response, Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireSeller, AuthRequest } from '../middleware/authMiddleware';
import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { productUseCases } from '../usecases/productUseCases';
import { orderUseCases } from '../usecases/orderUseCases';
import { sellerProductSchema } from './productRoutes';
import { writeLimiter } from '../middleware/rateLimiters';
import { sellerDeliveryProfileService } from '../services/sellerDeliveryProfileService';
import { yandexNddShipmentOrchestrator } from '../services/yandexNddShipmentOrchestrator';
import { payoutService } from '../services/payoutService';
import { shipmentService } from '../services/shipmentService';
import { yandexDeliveryService } from '../services/yandexDeliveryService';
import { sellerOrderDocumentsService } from '../services/sellerOrderDocumentsService';
import { getYandexNddConfig } from '../config/yandexNdd';
import { YandexNddHttpError, yandexNddClient } from '../services/yandexNdd/YandexNddClient';
import { normalizeDigitsStation } from '../services/yandexNdd/getOperatorStationId';
import { haversineDistanceMeters } from '../utils/geo';
import { TtlCache } from '../utils/cache';

export const sellerRoutes = Router();

const uploadDir = path.join(process.cwd(), 'uploads');
const kycUploadDir = path.join(uploadDir, 'kyc');
if (!fs.existsSync(kycUploadDir)) {
  fs.mkdirSync(kycUploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}-${file.originalname}`);
  }
});
const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const allowedVideoTypes = ['video/mp4', 'video/webm'];
const maxImageSize = 10 * 1024 * 1024;
const maxVideoSize = 100 * 1024 * 1024;
const upload = multer({
  storage,
  limits: {
    fileSize: maxVideoSize
  },
  fileFilter: (_req, file, cb) => {
    if ([...allowedImageTypes, ...allowedVideoTypes].includes(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error('UPLOAD_FILE_TYPE_INVALID'));
  }
});
const kycStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, kycUploadDir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}-${file.originalname}`);
  }
});
const kycUpload = multer({
  storage: kycStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('KYC_FILE_TYPE_INVALID'));
    }
    return cb(null, true);
  }
});

const sellerOnboardingSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(5),
  status: z.enum(['ИП', 'ООО', 'Самозанятый']),
  storeName: z.string().min(2),
  city: z.string().min(2),
  referenceCategory: z.string().min(2),
  catalogPosition: z.string().min(2)
});

const ensureSellerDeliveryProfile = async (sellerId: string) => {
  await prisma.sellerDeliveryProfile.upsert({
    where: { sellerId },
    create: { sellerId, dropoffSchedule: 'DAILY' },
    update: {}
  });
};

const resolveValidationSelfPickupId = () => {
  const value = process.env.YANDEX_NDD_VALIDATION_SELF_PICKUP_ID?.trim();
  return value || null;
};

const validateResolvedPlatformStationId = async (platformStationId: string | null, fallbackSelfPickupId: string) => {
  if (!platformStationId) {
    return { validatedPlatformStationId: null, warningCode: 'SELLER_STATION_ID_REQUIRED' as const };
  }

  const validationSelfPickupId = resolveValidationSelfPickupId() ?? fallbackSelfPickupId;
  if (!validationSelfPickupId) {
    return { validatedPlatformStationId: platformStationId, warningCode: null };
  }

  try {
    await yandexNddClient.offersInfo(platformStationId, validationSelfPickupId, true);
    return { validatedPlatformStationId: platformStationId, warningCode: null };
  } catch (error) {
    if (error instanceof YandexNddHttpError) {
      const details =
        error.details && typeof error.details === 'object'
          ? (error.details as Record<string, unknown>)
          : null;
      const detailsCode = String(details?.code ?? '');
      if (detailsCode === 'validation_error') {
        console.warn('[DROP_OFF_PVZ_VALIDATE_STATION] validation_error', {
          platformStationId,
          validationSelfPickupId,
          details: error.details
        });
        return { validatedPlatformStationId: null, warningCode: 'SELLER_STATION_ID_REQUIRED' as const };
      }
    }

    console.warn('[DROP_OFF_PVZ_VALIDATE_STATION] skipped', {
      platformStationId,
      validationSelfPickupId,
      reason: error instanceof Error ? error.message : String(error)
    });
    return { validatedPlatformStationId: platformStationId, warningCode: 'SELLER_STATION_VALIDATION_SKIPPED' as const };
  }
};

const validateSourcePlatformStationId = async (dropoffStationId: string) => {
  const { defaultPlatformStationId } = getYandexNddConfig();
  const normalized = normalizeDigitsStation(dropoffStationId);
  if (!normalized) {
    throw new Error('SELLER_STATION_ID_INVALID');
  }

  const selfPickupId = resolveValidationSelfPickupId();
  if (!selfPickupId) {
    return normalized;
  }

  try {
    await yandexNddClient.offersInfo(normalized, selfPickupId, true);
  } catch (_error) {
    if (defaultPlatformStationId && normalized === defaultPlatformStationId) {
      return normalized;
    }
    throw new Error('SELLER_STATION_ID_INVALID');
  }

  return normalized;
};

const normalizeOperatorStationDigits = (value: unknown): string | null => normalizeDigitsStation(value);

const readPlatformStationDigitsId = (point: Record<string, any>): string | null => {
  const station = point?.station && typeof point.station === 'object' ? point.station : null;
  const platformStation = point?.platform_station && typeof point.platform_station === 'object' ? point.platform_station : null;
  const candidates = [
    point?.platform_station_id,
    platformStation?.platform_id,
    point?.station_id,
    station?.id,
    station?.platform_id,
    station?.platform_station_id
  ];

  for (const candidate of candidates) {
    const normalized = normalizeDigitsStation(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

sellerRoutes.post('/onboarding', requireAuth, writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = sellerOnboardingSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { phoneVerifiedAt: true, phone: true }
    });
    if (!user?.phoneVerifiedAt) {
      return res.status(403).json({ error: { code: 'PHONE_NOT_VERIFIED' } });
    }
    const phone = user.phone ?? payload.phone;
    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        name: payload.name,
        phone,
        role: 'SELLER',
        sellerProfile: {
          upsert: {
            create: {
              status: payload.status,
              storeName: payload.storeName,
              phone,
              city: payload.city,
              referenceCategory: payload.referenceCategory,
              catalogPosition: payload.catalogPosition
            },
            update: {
              status: payload.status,
              storeName: payload.storeName,
              phone,
              city: payload.city,
              referenceCategory: payload.referenceCategory,
              catalogPosition: payload.catalogPosition
            }
          }
        }
      }
    });

    await ensureSellerDeliveryProfile(req.user!.userId);

    res.json({
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        role: updated.role
      }
    });
  } catch (error) {
    next(error);
  }
});


const loadSellerContext = async (userId: string) => {
  const profile = await prisma.sellerProfile.findUnique({
    where: { userId }
  });
  if (!profile) {
    return null;
  }
  const latestSubmission = await prisma.sellerKycSubmission.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { documents: true }
  });
  const approvedSubmission = await prisma.sellerKycSubmission.findFirst({
    where: { userId, status: 'APPROVED' },
    orderBy: { reviewedAt: 'desc' }
  });
  return {
    isSeller: true,
    profile,
    kyc: latestSubmission ?? null,
    canSell: Boolean(approvedSubmission)
  };
};

const respondSellerContext = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'SELLER') {
    return res.status(403).json({ code: 'FORBIDDEN', message: 'Seller only' });
  }

  await ensureSellerDeliveryProfile(req.user.userId);

  const context = await loadSellerContext(req.user.userId);
  if (!context) {
    console.warn('Seller profile missing for user', { userId: req.user.userId });
    return res.status(409).json({
      code: 'SELLER_PROFILE_MISSING',
      message: 'Seller onboarding required'
    });
  }
  return res.json({ data: context });
};

sellerRoutes.get('/context', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await respondSellerContext(req, res);
  } catch (error) {
    next(error);
  }
});

sellerRoutes.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await respondSellerContext(req, res);
  } catch (error) {
    next(error);
  }
});

sellerRoutes.use(requireAuth, requireSeller);

const orderStatusFlow: OrderStatus[] = [
  'CREATED',
  'PRINTING',
  'HANDED_TO_DELIVERY',
  'IN_TRANSIT',
  'DELIVERED'
];

const ensureKycApproved = async (userId: string) => {
  const approved = await prisma.sellerKycSubmission.findFirst({
    where: { userId, status: 'APPROVED' },
    orderBy: { reviewedAt: 'desc' }
  });
  return Boolean(approved);
};

const ensureReferenceCategory = async (category: string) => {
  const ref = await prisma.referenceCategory.findFirst({
    where: {
      isActive: true,
      OR: [{ title: category }, { slug: category }]
    }
  });
  if (!ref) {
    throw new Error('CATEGORY_INVALID');
  }
  return ref.title;
};


sellerRoutes.get('/kyc/me', async (req: AuthRequest, res, next) => {
  try {
    const submission = await prisma.sellerKycSubmission.findFirst({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: { documents: true }
    });
    res.json({ data: submission ?? null });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.post('/kyc/submit', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = z
      .object({
        dropoffPlatformStationId: z.string().optional(),
        dropoffStationMeta: z.record(z.string(), z.unknown()).optional()
      })
      .parse(req.body ?? {});

    const dropoffPlatformStationId = payload.dropoffPlatformStationId?.trim();
    if (!dropoffPlatformStationId) {
      return res.status(400).json({
        error: {
          code: 'SELLER_STATION_ID_REQUIRED',
          message: 'Точка отгрузки обязательна. В будущем можно изменить в настройках.'
        }
      });
    }

    await sellerDeliveryProfileService.upsert(req.user!.userId, {
      dropoffPlatformStationId,
      dropoffStationMeta: payload.dropoffStationMeta
    });

    const latest = await prisma.sellerKycSubmission.findFirst({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' }
    });
    if (latest && latest.status === 'PENDING') {
      return res.json({ data: latest });
    }
    const created = await prisma.sellerKycSubmission.create({
      data: {
        userId: req.user!.userId,
        status: 'PENDING',
        submittedAt: new Date()
      },
      include: { documents: true }
    });
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.post('/kyc/documents', writeLimiter, kycUpload.array('files', 5), async (req: AuthRequest, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) {
      return res.status(400).json({ error: { code: 'KYC_FILES_REQUIRED' } });
    }
    let submission = await prisma.sellerKycSubmission.findFirst({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' }
    });
    if (!submission || submission.status === 'REJECTED') {
      submission = await prisma.sellerKycSubmission.create({
        data: {
          userId: req.user!.userId,
          status: 'PENDING',
          submittedAt: new Date()
        }
      });
    }
    const createdDocs = await prisma.$transaction(
      files.map((file) =>
        prisma.sellerDocument.create({
          data: {
            submissionId: submission!.id,
            type: 'document',
            url: `/uploads/kyc/${file.filename}`,
            fileName: file.filename,
            originalName: file.originalname,
            mime: file.mimetype,
            size: file.size
          }
        })
      )
    );
    res.status(201).json({ data: { submissionId: submission.id, documents: createdDocs } });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.get('/products', async (req: AuthRequest, res, next) => {
  try {
    const approved = await ensureKycApproved(req.user!.userId);
    if (!approved && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: { code: 'KYC_NOT_APPROVED', message: 'KYC not approved' } });
    }
    const sellerProducts = await prisma.product.findMany({
      where: { sellerId: req.user!.userId },
      include: { images: { orderBy: { sortOrder: 'asc' } } }
    });
    res.json({ data: sellerProducts });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.post('/products', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const approved = await ensureKycApproved(req.user!.userId);
    if (!approved && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: { code: 'KYC_NOT_APPROVED', message: 'KYC not approved' } });
    }
    const payload = sellerProductSchema.parse(req.body);
    const normalizedCategory = await ensureReferenceCategory(payload.category);
    const skuFallback = payload.sku ?? `SKU-${Date.now()}`;
    if (!payload.imageUrls?.length && !payload.image) {
      return res.status(400).json({ error: { code: 'IMAGE_REQUIRED' } });
    }
    const providedImageUrls = payload.imageUrls ?? [];
    const imageUrls = providedImageUrls.length ? providedImageUrls : payload.image ? [payload.image] : [];
    const videoUrls = payload.videoUrls ?? [];
    const product = await productUseCases.create({
      ...payload,
      category: normalizedCategory,
      descriptionShort: payload.descriptionShort ?? payload.description,
      descriptionFull: payload.descriptionFull ?? payload.description,
      sku: skuFallback,
      currency: payload.currency ?? 'RUB',
      sellerId: req.user!.userId,
      image: imageUrls[0],
      imageUrls,
      videoUrls,
    });
    res.status(201).json({ data: product });
  } catch (error) {
    if (error instanceof Error && error.message === 'CATEGORY_INVALID') {
      return res.status(400).json({ error: { code: 'CATEGORY_INVALID', message: 'Категория недоступна.' } });
    }
    next(error);
  }
});

sellerRoutes.put('/products/:id', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const approved = await ensureKycApproved(req.user!.userId);
    if (!approved && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: { code: 'KYC_NOT_APPROVED', message: 'KYC not approved' } });
    }
    const payload = sellerProductSchema.partial().parse(req.body);
    const normalizedCategory = payload.category ? await ensureReferenceCategory(payload.category) : undefined;
    const imageUrls = payload.imageUrls ?? (payload.image ? [payload.image] : undefined);
    const videoUrls = payload.videoUrls;
    const product = await productUseCases.update(req.params.id, {
      ...payload,
      category: normalizedCategory ?? payload.category,
      descriptionShort: payload.descriptionShort ?? payload.description,
      descriptionFull: payload.descriptionFull ?? payload.description,
      sku: payload.sku,
      currency: payload.currency,
      sellerId: req.user!.userId,
      image: imageUrls?.[0] ?? payload.image,
      imageUrls,
      videoUrls,
    });
    res.json({ data: product });
  } catch (error) {
    if (error instanceof Error && error.message === 'CATEGORY_INVALID') {
      return res.status(400).json({ error: { code: 'CATEGORY_INVALID', message: 'Категория недоступна.' } });
    }
    next(error);
  }
});

sellerRoutes.post('/uploads', writeLimiter, upload.array('files', 10), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) {
    return res.status(400).json({ error: { code: 'FILES_REQUIRED' } });
  }
  const oversizedFiles = files.filter((file) => {
    if (allowedImageTypes.includes(file.mimetype)) {
      return file.size > maxImageSize;
    }
    if (allowedVideoTypes.includes(file.mimetype)) {
      return file.size > maxVideoSize;
    }
    return true;
  });
  if (oversizedFiles.length) {
    await Promise.all(files.map((file) => fs.promises.unlink(file.path).catch(() => undefined)));
    return res.status(400).json({ error: { code: 'FILE_TOO_LARGE' } });
  }
  const urls = files.map((file) => `/uploads/${file.filename}`);
  res.json({ data: { urls } });
});

sellerRoutes.delete('/products/:id', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const approved = await ensureKycApproved(req.user!.userId);
    if (!approved && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: { code: 'KYC_NOT_APPROVED', message: 'KYC not approved' } });
    }
    await productUseCases.remove(req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

const sellerOrdersQuerySchema = z.object({
  status: z
    .enum(['CREATED', 'PRINTING', 'HANDED_TO_DELIVERY', 'IN_TRANSIT', 'DELIVERED'])
    .optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

const sellerOrderStatusSchema = z.object({
  status: z.enum(['CREATED', 'PRINTING', 'HANDED_TO_DELIVERY', 'IN_TRANSIT', 'DELIVERED']),
  trackingNumber: z.string().min(2).optional(),
  carrier: z.string().min(2).optional()
});


const sourcePlatformStationSchema = z.object({
  source_platform_station: z.string().min(1).trim()
});

const sellerSettingsSchema = z.object({
  dropoffSchedule: z.enum(['DAILY', 'WEEKDAYS'])
});

const sellerDeliveryProfileSchema = z.object({
  dropoffPvz: z.object({
    pvzId: z.string().trim().min(1),
    provider: z.literal('YANDEX_NDD').optional(),
    raw: z.unknown().optional(),
    addressFull: z.string().optional(),
    country: z.string().optional(),
    locality: z.string().optional(),
    street: z.string().optional(),
    house: z.string().optional(),
    comment: z.string().optional()
  })
});

const dropoffStationsQuerySchema = z.object({
  geoId: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

const dropoffStationsSearchBodySchema = z.object({
  query: z.string().trim().min(2),
  geoId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50)
});

const MAX_FETCH_LIMIT = 5000;
const GEOCODER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const geocoderCache = new TtlCache<string, { lat: number; lon: number; precision?: string | null; text?: string | null }>(500);

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();

const queryLooksLikeAddress = (query: string) => /\d/.test(query) && query.trim().length > 6;

const hasCoordinates = (
  point: ReturnType<typeof mapSellerDropoffPoint>
): point is ReturnType<typeof mapSellerDropoffPoint> & { position: { latitude: number; longitude: number } } =>
  typeof point.position?.latitude === 'number' && typeof point.position?.longitude === 'number';

const tokenize = (value: string) => normalizeText(value).split(' ').filter(Boolean);

const textSearchRank = (query: string, point: ReturnType<typeof mapSellerDropoffPoint>) => {
  const haystack = normalizeText(`${point.name ?? ''} ${point.addressFull ?? ''} ${(point as any).instruction ?? ''}`);
  const tokens = tokenize(query);
  if (!tokens.length) {
    return 0;
  }
  const matches = tokens.filter((token) => haystack.includes(token)).length;
  return matches / tokens.length;
};

const geocodeAddress = async (query: string) => {
  const apiKey = process.env.YMAPS_GEOCODER_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const cacheKey = normalizeText(query);
  const cached = geocoderCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const geocode = `${query}, Москва`;
  const url = new URL('https://geocode-maps.yandex.ru/1.x/');
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('format', 'json');
  url.searchParams.set('lang', 'ru_RU');
  url.searchParams.set('geocode', geocode);

  const response = await fetch(url.toString());
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as any;
  const first = payload?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
  const pos = String(first?.Point?.pos ?? '').trim();
  const [lonRaw, latRaw] = pos.split(' ');
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const value = {
    lat,
    lon,
    precision: first?.metaDataProperty?.GeocoderMetaData?.precision ?? null,
    text: first?.metaDataProperty?.GeocoderMetaData?.text ?? null
  };
  geocoderCache.set(cacheKey, value, GEOCODER_TTL_MS);
  return value;
};

const mapSellerDropoffPoint = (point: Record<string, any>) => ({
  pvzId: typeof point?.id === 'string' ? point.id : null,
  platformStationIdDigits: readPlatformStationDigitsId(point),
  operatorStationId: normalizeOperatorStationDigits(point?.operator_station_id),
  name: typeof point?.name === 'string' ? point.name : null,
  addressFull: point?.address?.full_address ?? null,
  instruction: typeof point?.instruction === 'string' ? point.instruction : null,
  geoId: point?.address?.geoId ?? point?.address?.geo_id ?? null,
  position: point?.position ?? null,
  available_for_c2c_dropoff:
    typeof point?.available_for_c2c_dropoff === 'boolean' ? point.available_for_c2c_dropoff : null,
  available_for_dropoff: typeof point?.available_for_dropoff === 'boolean' ? point.available_for_dropoff : null,
  maxWeightGross: null,
  distanceMeters: null as number | null
});

const dropoffStationSaveSchema = z.object({
  stationId: z.string().trim().min(1),
  addressFull: z.string().optional(),
  raw: z.unknown().optional(),
  geoId: z.coerce.number().int().positive().optional(),
  query: z.string().optional(),
  position: z
    .object({
      latitude: z.coerce.number(),
      longitude: z.coerce.number()
    })
    .optional()
});

sellerRoutes.get('/settings', async (req: AuthRequest, res, next) => {
  try {
    await ensureSellerDeliveryProfile(req.user!.userId);
    const [settings, deliveryProfile] = await Promise.all([
      prisma.sellerSettings.findUnique({ where: { sellerId: req.user!.userId } }),
      prisma.sellerDeliveryProfile.findUnique({ where: { sellerId: req.user!.userId } })
    ]);

    res.json({
      data: {
        ...(settings ?? { sellerId: req.user!.userId }),
        dropoffPlatformStationId: deliveryProfile?.dropoffPlatformStationId ?? null,
        dropoffOperatorStationId: deliveryProfile?.dropoffOperatorStationId ?? null,
        dropoffStationMeta: deliveryProfile?.dropoffStationMeta ?? null,
        dropoffSchedule: deliveryProfile?.dropoffSchedule ?? 'DAILY',
        dropoffPvz: settings?.defaultDropoffPvzId
          ? {
              provider: 'YANDEX_NDD',
              pvzId: settings.defaultDropoffPvzId,
              raw: settings.defaultDropoffPvzMeta,
              addressFull:
                typeof settings.defaultDropoffPvzMeta === 'object' && settings.defaultDropoffPvzMeta
                  ? String((settings.defaultDropoffPvzMeta as Record<string, unknown>).addressFull ?? '')
                  : undefined
            }
          : null
      }
    });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.get('/ndd/dropoff-stations', async (req: AuthRequest, res, next) => {
  try {
    const geoIdRaw = typeof req.query?.geoId === 'string' ? req.query.geoId : String(req.query?.geoId ?? '');
    const geoId = Number(geoIdRaw);
    if (!geoIdRaw.trim() || Number.isNaN(geoId) || !Number.isFinite(geoId) || geoId <= 0) {
      return res.status(400).json({
        error: {
          code: 'GEO_ID_REQUIRED',
          message: 'geoId обязателен'
        }
      });
    }

    const { limit = 100 } = dropoffStationsQuerySchema.parse({
      geoId,
      limit: req.query?.limit
    });

    const pickupPointResp = await yandexNddClient.pickupPointsList({
      geo_id: geoId,
      type: 'pickup_point',
      available_for_dropoff: true,
      available_for_c2c_dropoff: true,
      is_yandex_branded: false,
      is_not_branded_partner_station: true
    });

    const terminalResp = await yandexNddClient.pickupPointsList({
      geo_id: geoId,
      type: 'terminal',
      available_for_dropoff: true,
      available_for_c2c_dropoff: true,
      is_yandex_branded: false,
      is_not_branded_partner_station: true
    });

    const warehouseResp = await yandexNddClient.pickupPointsList({
      geo_id: geoId,
      type: 'warehouse',
      available_for_dropoff: true,
      available_for_c2c_dropoff: true,
      is_yandex_branded: false,
      is_not_branded_partner_station: true
    });

    const pickupPointsRaw =
      (pickupPointResp as any)?.points ??
      (pickupPointResp as any)?.result?.points ??
      [];
    const terminalPointsRaw =
      (terminalResp as any)?.points ??
      (terminalResp as any)?.result?.points ??
      [];
    const warehousePointsRaw =
      (warehouseResp as any)?.points ??
      (warehouseResp as any)?.result?.points ??
      [];

    const incomingPoints = [
      ...(Array.isArray(pickupPointsRaw) ? pickupPointsRaw : []),
      ...(Array.isArray(terminalPointsRaw) ? terminalPointsRaw : []),
      ...(Array.isArray(warehousePointsRaw) ? warehousePointsRaw : [])
    ];
    const droppedReasons = {
      missingId: 0,
      outOfLimit: Math.max(incomingPoints.length - limit, 0)
    };

    const points = incomingPoints
      .slice(0, limit)
      .map((point: Record<string, any>) => mapSellerDropoffPoint(point));

    for (const point of points) {
      if (!point.pvzId) {
        droppedReasons.missingId += 1;
      }
    }

    console.info('[DROP_OFF_STATIONS]', {
      geoId,
      incomingStationsCount: incomingPoints.length,
      afterFiltersCount: points.length,
      pointsCount: points.length,
      filterReasons: droppedReasons,
      sample: points[0]?.platformStationIdDigits
    });

    return res.json({ points });
  } catch (error) {
    if (error instanceof YandexNddHttpError && error.code === 'NDD_REQUEST_FAILED') {
      return res.status(502).json({
        error: {
          code: 'NDD_REQUEST_FAILED',
          message: 'Не удалось получить станции сдачи из NDD.',
          details: (error as any).details ?? null
        }
      });
    }
    return next(error);
  }
});

sellerRoutes.post('/ndd/dropoff-stations/search', async (req: AuthRequest, res, next) => {
  try {
    const { query, geoId: providedGeoId, limit } = dropoffStationsSearchBodySchema.parse(req.body ?? {});

    const geoId = providedGeoId ?? 213;

    const pickupPointResp = await yandexNddClient.pickupPointsList({
      geo_id: geoId,
      type: 'pickup_point',
      available_for_dropoff: true,
      available_for_c2c_dropoff: true,
      is_yandex_branded: false,
      is_not_branded_partner_station: true,
      limit: MAX_FETCH_LIMIT
    });

    const terminalResp = await yandexNddClient.pickupPointsList({
      geo_id: geoId,
      type: 'terminal',
      available_for_dropoff: true,
      available_for_c2c_dropoff: true,
      is_yandex_branded: false,
      is_not_branded_partner_station: true,
      limit: MAX_FETCH_LIMIT
    });

    const warehouseResp = await yandexNddClient.pickupPointsList({
      geo_id: geoId,
      type: 'warehouse',
      available_for_dropoff: true,
      available_for_c2c_dropoff: true,
      is_yandex_branded: false,
      is_not_branded_partner_station: true,
      limit: MAX_FETCH_LIMIT
    });

    const pickupPointsRaw =
      (pickupPointResp as any)?.points ??
      (pickupPointResp as any)?.result?.points ??
      [];
    const terminalPointsRaw =
      (terminalResp as any)?.points ??
      (terminalResp as any)?.result?.points ??
      [];
    const warehousePointsRaw =
      (warehouseResp as any)?.points ??
      (warehouseResp as any)?.result?.points ??
      [];

    const allPoints = [
      ...(Array.isArray(pickupPointsRaw) ? pickupPointsRaw : []),
      ...(Array.isArray(terminalPointsRaw) ? terminalPointsRaw : []),
      ...(Array.isArray(warehousePointsRaw) ? warehousePointsRaw : [])
    ];
    const rawPointsCount = allPoints.length;

    if (allPoints.length >= MAX_FETCH_LIMIT) {
      console.info('[NDD_DROP_OFF_SEARCH] reached fetch cap', { geoId, count: allPoints.length, cap: MAX_FETCH_LIMIT });
    }

    const normalizedPoints = allPoints
      .map((point: Record<string, any>) => mapSellerDropoffPoint(point))
      .filter((point) => Boolean(point.pvzId))
      .filter((point) => point.available_for_c2c_dropoff !== false);

    const isAddressSearch = queryLooksLikeAddress(query);
    const geocode = isAddressSearch ? await geocodeAddress(query) : null;
    let resultPoints = normalizedPoints;

    if (geocode) {
      resultPoints = normalizedPoints
        .map((point) => {
          if (!hasCoordinates(point)) {
            return { ...point, distanceMeters: null };
          }
          return {
            ...point,
            distanceMeters: Math.round(
              haversineDistanceMeters(
                { latitude: geocode.lat, longitude: geocode.lon },
                { latitude: point.position.latitude, longitude: point.position.longitude }
              )
            )
          };
        })
        .sort((a, b) => {
          const aDistance = a.distanceMeters;
          const bDistance = b.distanceMeters;
          if (aDistance == null && bDistance == null) return 0;
          if (aDistance == null) return 1;
          if (bDistance == null) return -1;
          return aDistance - bDistance;
        });
    } else {
      const ranked = normalizedPoints
        .map((point) => ({ point, rank: textSearchRank(query, point) }))
        .filter(({ rank }) => rank >= 0.5)
        .sort((a, b) => b.rank - a.rank)
        .map(({ point }) => point);
      resultPoints = ranked;
    }

    resultPoints = resultPoints.slice(0, limit);

    console.info('[NDD_DROP_OFF_SEARCH]', {
      query,
      geoId,
      rawPointsCount,
      normalizedPointsCount: normalizedPoints.length,
      outputPointsCount: resultPoints.length,
      points: resultPoints.length,
      geocoded: Boolean(geocode)
    });

    return res.json({
      points: resultPoints,
      debug: {
        geoId,
        ...(geocode
          ? {
              geocode: {
                lat: geocode.lat,
                lon: geocode.lon,
                precision: geocode.precision,
                text: geocode.text
              }
            }
          : {})
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          code: 'GEO_QUERY_REQUIRED',
          message: 'Параметр query обязателен и должен быть не короче 2 символов.'
        }
      });
    }

    if (error instanceof YandexNddHttpError && error.code === 'NDD_REQUEST_FAILED') {
      const unauthorized = error.status === 401 || error.status === 403;
      return res.status(502).json({
        error: {
          code: 'NDD_REQUEST_FAILED',
          message: unauthorized ? 'Нет доступа к NDD (проверь токен/BASE_URL).' : 'Не удалось получить станции сдачи из NDD.',
          details: unauthorized
            ? { code: 'unauthorized', message: 'Not authorized request' }
            : (error as any).details ?? null
        }
      });
    }

    if (error instanceof TypeError) {
      return res.status(502).json({
        error: {
          code: 'NDD_REQUEST_FAILED',
          message: 'Ошибка сети при запросе станций сдачи.',
          details: error.message
        }
      });
    }

    return next(error);
  }
});

sellerRoutes.put('/settings', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = sellerSettingsSchema.parse(req.body ?? {});
    const profile = await sellerDeliveryProfileService.upsert(req.user!.userId, {
      dropoffSchedule: payload.dropoffSchedule
    });

    res.json({ data: profile });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.put('/settings/dropoff-station', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = dropoffStationSaveSchema.parse(req.body ?? {});
    const stationId = payload.stationId.trim();
    const validatedStationId = await validateSourcePlatformStationId(stationId);

    const profile = await sellerDeliveryProfileService.upsert(req.user!.userId, {
      dropoffPlatformStationId: validatedStationId,
      dropoffStationMeta: {
        source: 'ndd/location_detect+pickup_points_list',
        source_platform_station: validatedStationId,
        addressFull: payload.addressFull,
        geoId: payload.geoId,
        query: payload.query,
        position: payload.position,
        raw: payload.raw ?? null
      }
    });

    return res.json({ data: profile });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          code: 'DROP_OFF_STATION_ID_REQUIRED',
          message: 'Не выбран id станции сдачи (stationId).'
        }
      });
    }
    if (error instanceof Error && error.message === 'SELLER_STATION_ID_INVALID') {
      return res.status(400).json({
        error: {
          code: 'SELLER_STATION_ID_INVALID',
          message: 'Укажите корректный stationId.'
        }
      });
    }
    return next(error);
  }
});

sellerRoutes.put('/settings/source-platform-station', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = sourcePlatformStationSchema.parse(req.body ?? {});
    const validatedStationId = await validateSourcePlatformStationId(payload.source_platform_station);

    const profile = await sellerDeliveryProfileService.upsert(req.user!.userId, {
      dropoffPlatformStationId: validatedStationId,
      dropoffStationMeta: {
        source: 'manual_input',
        sourcePlatformStation: validatedStationId
      }
    });

    return res.json({ data: profile });
  } catch (error) {
    if (error instanceof Error && error.message === 'SELLER_STATION_ID_INVALID') {
      return res.status(400).json({ error: { code: 'SELLER_STATION_ID_INVALID', message: 'Укажите корректный source_platform_station' } });
    }
    return next(error);
  }
});

sellerRoutes.put('/settings/dropoff-pvz', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = sellerDeliveryProfileSchema.parse(req.body);
    const pvzId = String(payload.dropoffPvz.pvzId ?? '').trim();
    console.info('[DROP_OFF_SAVE]', { pvzId });
    if (!pvzId) {
      return res.status(400).json({ error: { code: 'DROP_OFF_PVZ_ID_REQUIRED', message: 'Не выбран id точки (pvzId).' } });
    }

    const listResp = await yandexNddClient.pickupPointsList({ pickup_point_ids: [pvzId] });
    const points =
      (listResp as any)?.points ??
      (listResp as any)?.result?.points ??
      [];
    const point = Array.isArray(points) ? points[0] : null;

    if (!point) {
      return res.status(400).json({
        error: {
          code: 'DROP_OFF_PVZ_NOT_FOUND',
          message: 'Точка не найдена в NDD.'
        }
      });
    }

    if ((point as any).available_for_c2c_dropoff === false || (point as any).available_for_dropoff === false) {
      return res.status(400).json({
        error: {
          code: 'DROP_OFF_NOT_AVAILABLE',
          message: 'Эта точка недоступна для отгрузки. Выберите другую.'
        }
      });
    }

    if ((point as any).type && !['pickup_point', 'terminal', 'warehouse'].includes((point as any).type)) {
      return res.status(400).json({
        error: {
          code: 'DROP_OFF_TYPE_INVALID',
          message: 'Эта точка не поддерживает сдачу отправлений. Выберите пункт приёма.'
        }
      });
    }

    const operatorStationId = normalizeOperatorStationDigits((point as any).operator_station_id);
    const platformStationId = readPlatformStationDigitsId(point as Record<string, any>);
    const validationResult = await validateResolvedPlatformStationId(platformStationId, pvzId);

    const dropoffPvzMeta = {
      provider: 'YANDEX_NDD' as const,
      pvzId,
      addressFull:
        payload.dropoffPvz.addressFull ??
        ((point as any)?.address?.full_address ?? undefined),
      raw: point
    };

    console.info('[DROP_OFF_PVZ_RESOLVE]', {
      pvzId,
      type: (point as any).type,
      available_for_dropoff: (point as any).available_for_dropoff,
      available_for_c2c_dropoff: (point as any).available_for_c2c_dropoff,
      operatorStationId,
      platformStationId
    });

    const settings = await prisma.sellerSettings.upsert({
      where: { sellerId: req.user!.userId },
      create: {
        sellerId: req.user!.userId,
        defaultDropoffPvzId: pvzId,
        defaultDropoffPvzMeta: dropoffPvzMeta as unknown as object
      },
      update: {
        defaultDropoffPvzId: pvzId,
        defaultDropoffPvzMeta: dropoffPvzMeta as unknown as object
      }
    });

    await sellerDeliveryProfileService.upsert(req.user!.userId, {
      dropoffPvzId: pvzId,
      dropoffOperatorStationId: operatorStationId,
      dropoffPlatformStationId: platformStationId,
      dropoffStationMeta: {
        source: 'pickup-points/list',
        pvz_id: pvzId,
        platform_station_id: platformStationId,
        operator_station_id: operatorStationId,
        raw: point
      }
    });

    await prisma.sellerDeliveryProfile.update({
      where: { sellerId: req.user!.userId },
      data: { dropoffStationId: platformStationId }
    });

    if (!platformStationId) {
      return res.status(202).json({
        data: settings,
        warning: {
          code: 'SELLER_STATION_ID_REQUIRED',
          message: 'ПВЗ сохранён, но station_id платформы не определён. Выберите другой ПВЗ или обратитесь в поддержку.'
        }
      });
    }

    if (validationResult.warningCode === 'SELLER_STATION_ID_REQUIRED') {
      return res.status(202).json({
        data: settings,
        warning: {
          code: 'SELLER_STATION_ID_REQUIRED',
          message: 'ПВЗ сохранён, но проверка station_id через offers/info вернула validation_error. Сохранённый station_id будет использован при отгрузке.'
        }
      });
    }

    if (validationResult.warningCode === 'SELLER_STATION_VALIDATION_SKIPPED') {
      return res.status(202).json({
        data: settings,
        warning: {
          code: 'SELLER_STATION_VALIDATION_SKIPPED',
          message: 'ПВЗ сохранён, но проверка station_id через offers/info недоступна. Проверьте отправку тестового заказа.'
        }
      });
    }

    res.json({ data: settings });
  } catch (error) {
    next(error);
  }
});


sellerRoutes.post('/settings/dropoff-pvz/test-station', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    }

    const devStationId = process.env.YANDEX_NDD_DEV_OPERATOR_STATION_ID?.trim();
    if (!devStationId || !/^\d+$/.test(devStationId)) {
      return res.status(400).json({ error: { code: 'OPERATOR_STATION_ID_MISSING' } });
    }

    await sellerDeliveryProfileService.upsert(req.user!.userId, {
      dropoffPlatformStationId: devStationId,
      dropoffStationMeta: {
        source: 'dev-endpoint',
        sourcePlatformStation: devStationId
      }
    });

    return res.json({ data: { source_platform_station: devStationId } });
  } catch (error) {
    return next(error);
  }
});

sellerRoutes.post('/orders/:id/yandex/labels', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, items: { some: { product: { sellerId: req.user!.userId } } } },
      select: { id: true, yandexRequestId: true }
    });
    if (!order?.yandexRequestId) {
      return res.status(400).json({ error: { code: 'YANDEX_REQUEST_ID_REQUIRED' } });
    }
    const file = await yandexDeliveryService.generateLabels([order.yandexRequestId], 'one', 'ru');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="label_${order.id}.pdf"`);
    res.send(file.buffer);
  } catch (error) {
    next(error);
  }
});

const handoverSchema = z.object({
  mode: z.enum(['new_requests', 'by_request_ids', 'by_date_range']).default('new_requests'),
  request_ids: z.array(z.string()).optional(),
  created_since: z.number().optional(),
  created_until: z.number().optional(),
  created_since_utc: z.string().optional(),
  created_until_utc: z.string().optional(),
  editable_format: z.boolean().optional()
});

sellerRoutes.post('/yandex/handover-act', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = handoverSchema.parse(req.body);
    const params: Record<string, unknown> = { editable_format: payload.editable_format ?? false };
    let body: Record<string, unknown> = {};

    if (payload.mode === 'new_requests') {
      params.new_requests = true;
    } else if (payload.mode === 'by_request_ids') {
      body = { request_ids: payload.request_ids ?? [] };
    } else {
      if (payload.created_since !== undefined) params.created_since = payload.created_since;
      if (payload.created_until !== undefined) params.created_until = payload.created_until;
      if (payload.created_since_utc) params.created_since_utc = payload.created_since_utc;
      if (payload.created_until_utc) params.created_until_utc = payload.created_until_utc;
    }

    const file = await yandexDeliveryService.getHandoverAct(params, body);
    const ext = payload.editable_format ? 'docx' : 'pdf';
    const contentType = payload.editable_format
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="handover_act_${Date.now()}.${ext}"`);
    res.send(file.buffer);
  } catch (error) {
    next(error);
  }
});

sellerRoutes.get('/orders', async (req: AuthRequest, res, next) => {
  try {
    const query = sellerOrdersQuerySchema.parse(req.query);
    const orders = await orderUseCases.listBySeller(req.user!.userId, {
      status: query.status as OrderStatus | undefined,
      offset: query.offset,
      limit: query.limit
    });
    const shipments = await shipmentService.getByOrderIds(orders.map((order) => order.id));
    res.json({ data: orders.map((order) => ({ ...order, shipment: shipments.get(order.id) ?? null })) });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.post('/orders/:orderId/ready-to-ship', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const shipment = await yandexNddShipmentOrchestrator.readyToShip(req.user!.userId, req.params.orderId);
    res.json({ data: shipment });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.get('/orders/:orderId/shipping-label', async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.orderId,
        items: { some: { product: { sellerId: req.user!.userId } } }
      },
      select: { id: true }
    });
    if (!order) {
      return res.status(404).json({ error: { code: 'ORDER_NOT_FOUND' } });
    }

    const result = await yandexNddShipmentOrchestrator.generateLabel(order.id);
    if (result.pdfBuffer) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="shipping-label-${order.id}.pdf"`);
      return res.send(result.pdfBuffer);
    }

    return res.json({ data: { url: result.url, raw: result.raw } });
  } catch (error) {
    next(error);
  }
});

const loadSellerOrderForDocuments = async (sellerId: string, orderId: string) =>
  prisma.order.findFirst({
    where: { id: orderId, items: { some: { product: { sellerId } } } },
    include: { items: { include: { product: true } } }
  });

sellerRoutes.get('/orders/:orderId/documents/packing-slip.pdf', async (req: AuthRequest, res, next) => {
  try {
    const order = await loadSellerOrderForDocuments(req.user!.userId, req.params.orderId);
    if (!order) return res.status(404).json({ error: { code: 'ORDER_NOT_FOUND' } });

    const pdf = await sellerOrderDocumentsService.buildPackingSlip(order);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="packing-slip-${order.id}.pdf"`);
    return res.status(200).send(pdf);
  } catch (error) {
    return next(error);
  }
});

sellerRoutes.get('/orders/:orderId/documents/labels.pdf', async (req: AuthRequest, res, next) => {
  try {
    const order = await loadSellerOrderForDocuments(req.user!.userId, req.params.orderId);
    if (!order) return res.status(404).json({ error: { code: 'ORDER_NOT_FOUND' } });

    const pdf = await sellerOrderDocumentsService.buildLabels(order);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="labels-${order.id}.pdf"`);
    return res.status(200).send(pdf);
  } catch (error) {
    return next(error);
  }
});

sellerRoutes.get('/orders/:orderId/documents/handover-act.pdf', async (req: AuthRequest, res, next) => {
  try {
    const order = await loadSellerOrderForDocuments(req.user!.userId, req.params.orderId);
    if (!order) return res.status(404).json({ error: { code: 'ORDER_NOT_FOUND' } });

    const pdf = await sellerOrderDocumentsService.buildHandoverAct(order);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="handover-act-${order.id}.pdf"`);
    return res.status(200).send(pdf);
  } catch (error) {
    return next(error);
  }
});

sellerRoutes.get('/payments', async (req: AuthRequest, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      where: {
        order: {
          items: { some: { product: { sellerId: req.user!.userId } } }
        }
      },
      select: {
        id: true,
        orderId: true,
        amount: true,
        status: true,
        currency: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ data: payments });
  } catch (error) {
    next(error);
  }
});

sellerRoutes.patch('/orders/:id/status', writeLimiter, async (req: AuthRequest, res, next) => {
  try {
    const payload = sellerOrderStatusSchema.parse(req.body);
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.id,
        items: { some: { product: { sellerId: req.user!.userId } } }
      },
      include: {
        items: {
          where: { product: { sellerId: req.user!.userId } },
          include: { product: true, variant: true }
        },
        contact: true,
        shippingAddress: true,
        buyer: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: { code: 'ORDER_NOT_FOUND' } });
    }

    const currentIndex = orderStatusFlow.indexOf(order.status);
    const nextIndex = orderStatusFlow.indexOf(payload.status);
    if (currentIndex === -1 || nextIndex === -1) {
      return res.status(400).json({ error: { code: 'STATUS_INVALID' } });
    }
    if (order.status === 'DELIVERED') {
      return res.status(400).json({ error: { code: 'STATUS_FINAL' } });
    }
    if (nextIndex <= currentIndex) {
      return res.status(400).json({ error: { code: 'STATUS_BACKWARD' } });
    }
    if (nextIndex !== currentIndex + 1) {
      return res.status(400).json({ error: { code: 'STATUS_SKIP_NOT_ALLOWED' } });
    }

    const trackingNumber = payload.trackingNumber ?? order.trackingNumber ?? undefined;
    const carrier = payload.carrier ?? order.carrier ?? undefined;
    if (
      ['HANDED_TO_DELIVERY', 'IN_TRANSIT', 'DELIVERED'].includes(payload.status) &&
      (!trackingNumber || !carrier)
    ) {
      return res.status(400).json({ error: { code: 'TRACKING_REQUIRED' } });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: payload.status,
          statusUpdatedAt: new Date(),
          trackingNumber,
          carrier
        },
        include: {
          items: {
            where: { product: { sellerId: req.user!.userId } },
            include: { product: true, variant: true }
          },
          contact: true,
          shippingAddress: true,
          buyer: true
        }
      });

      if (payload.status === 'DELIVERED') {
        await payoutService.releaseForDeliveredOrder(order.id, tx as any);
      }

      return nextOrder;
    });

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});


sellerRoutes.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    const orders = await orderUseCases.listBySeller(req.user!.userId);
    const revenue = orders.reduce(
      (sum, order) =>
        sum +
        order.items.reduce((itemSum, item) => itemSum + item.priceAtPurchase * item.quantity, 0),
      0
    );
    const products = await prisma.product.findMany({ where: { sellerId: req.user!.userId } });
    const statusCounts = orderStatusFlow.reduce(
      (acc, status) => {
        acc[status] = orders.filter((order) => order.status === status).length;
        return acc;
      },
      {} as Record<OrderStatus, number>
    );
    res.json({
      data: {
        totalOrders: orders.length,
        totalRevenue: revenue,
        totalProducts: products.length,
        statusCounts
      }
    });
  } catch (error) {
    next(error);
  }
});
