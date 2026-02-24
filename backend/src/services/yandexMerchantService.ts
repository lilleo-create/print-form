import { prisma } from '../lib/prisma';
import { yandexDeliveryService } from './yandexDeliveryService';
import { getYandexNddConfig } from '../config/yandexNdd';

export type MerchantEnsureResult =
  | { status: 'ready'; merchantId: string }
  | { status: 'in_progress'; message?: string }
  | { status: 'validation_error'; details: unknown }
  | { status: 'missing_data'; missingFields: string[] };

const LEGAL_TYPE_OOO = 'ООО';
const LEGAL_TYPE_IP = 'ИП';
const LEGAL_TYPE_SAMOZANYATY = 'Самозанятый';

function requiredFieldsForLegalType(legalType: string | null): string[] {
  const base = ['contactName', 'contactEmail', 'contactPhone', 'legalAddressFull', 'siteUrl', 'inn'];
  if (legalType === LEGAL_TYPE_OOO) {
    return [...base, 'legalName', 'ogrn', 'kpp', 'representativeName'];
  }
  if (legalType === LEGAL_TYPE_IP) {
    return [...base, 'ogrn'];
  }
  if (legalType === LEGAL_TYPE_SAMOZANYATY) {
    return base;
  }
  return base;
}

function getMissingMerchantFields(profile: {
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  representativeName: string | null;
  legalType: string | null;
  legalName: string | null;
  inn: string | null;
  ogrn: string | null;
  kpp: string | null;
  legalAddressFull: string | null;
  siteUrl: string | null;
}): string[] {
  const required = requiredFieldsForLegalType(profile.legalType);
  const missing: string[] = [];
  for (const field of required) {
    const value = (profile as Record<string, string | null>)[field];
    if (value === undefined || value === null || String(value).trim() === '') {
      missing.push(field);
    }
  }
  if (profile.legalType === LEGAL_TYPE_OOO && (!profile.kpp || profile.kpp.trim() === '')) {
    if (!missing.includes('kpp')) missing.push('kpp');
  }
  return missing;
}

function buildInitPayload(profile: {
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  representativeName: string | null;
  legalType: string | null;
  legalName: string | null;
  inn: string | null;
  ogrn: string | null;
  kpp: string | null;
  legalAddressFull: string | null;
  siteUrl: string | null;
  shipmentType: string | null;
}) {
  const contact = {
    name: String(profile.contactName ?? '').trim(),
    email: String(profile.contactEmail ?? '').trim(),
    phone: String(profile.contactPhone ?? '').trim(),
    representative_name: String(profile.representativeName ?? profile.contactName ?? '').trim()
  };

  const legalType = profile.legalType ?? 'ИП';
  const legalInfo: Record<string, unknown> = {
    type: legalType === LEGAL_TYPE_OOO ? 'legal_entity' : legalType === LEGAL_TYPE_IP ? 'individual_entrepreneur' : 'self_employed',
    name: String(profile.legalName ?? '').trim(),
    inn: String(profile.inn ?? '').trim(),
    address: String(profile.legalAddressFull ?? '').trim()
  };
  if (profile.ogrn && profile.ogrn.trim()) legalInfo.ogrn = profile.ogrn.trim();
  if (profile.kpp && profile.kpp.trim()) legalInfo.kpp = profile.kpp.trim();

  const site_url = String(profile.siteUrl ?? '').trim();
  const shipment_type = (profile.shipmentType === 'withdraw' ? 'withdraw' : 'import') as 'import' | 'withdraw';

  return { contact, legal_info: legalInfo, site_url, shipment_type };
}

export const yandexMerchantService = {
  async ensureForSeller(sellerId: string): Promise<MerchantEnsureResult> {
    const config = getYandexNddConfig();
    if (!config.enabled || !config.token) {
      return { status: 'missing_data', missingFields: ['NDD_NOT_CONFIGURED'] };
    }

    const profile = await prisma.sellerProfile.findFirst({
      where: { userId: sellerId }
    });
    if (!profile) {
      return { status: 'missing_data', missingFields: ['SELLER_PROFILE_NOT_FOUND'] };
    }

    if (profile.yandexMerchantId && profile.yandexMerchantId.trim()) {
      return { status: 'ready', merchantId: profile.yandexMerchantId.trim() };
    }

    const missingFields = getMissingMerchantFields(profile);
    if (missingFields.length > 0) {
      return { status: 'missing_data', missingFields };
    }

    const externalMerchantId = `seller_${sellerId}`;

    if (!profile.yandexMerchantRegistrationId || profile.yandexMerchantRegistrationId.trim() === '') {
      try {
        const payload = buildInitPayload(profile);
        const initRes = await yandexDeliveryService.merchantRegistrationInit(externalMerchantId, payload);
        const registrationId = initRes?.registration_id ?? '';
        if (!registrationId) {
          console.warn('[YANDEX_MERCHANT] init response without registration_id', { sellerId });
          return { status: 'in_progress', message: 'Регистрация мерчанта запущена, идентификатор не получен.' };
        }
        await prisma.sellerProfile.update({
          where: { userId: sellerId },
          data: {
            yandexMerchantRegistrationId: registrationId,
            yandexMerchantStatus: 'in_progress',
            yandexMerchantError: null
          }
        });
        if (config.baseUrl) {
          console.info('[YANDEX_MERCHANT] init', {
            sellerId,
            registrationId: registrationId.slice(0, 8) + '...',
            baseUrl: config.baseUrl
          });
        }
        return { status: 'in_progress', message: 'Регистрация мерчанта в процессе.' };
      } catch (err) {
        const ax = err as { response?: { status?: number; data?: unknown } };
        const status = ax.response?.status;
        const data = ax.response?.data as Record<string, unknown> | undefined;
        const code = data?.code ?? (data?.error as Record<string, unknown>)?.code;
        const details = data?.details ?? data?.error ?? data;
        console.warn('[YANDEX_MERCHANT] init failed', {
          sellerId,
          status,
          code,
          details: details ? JSON.stringify(details).slice(0, 500) : undefined
        });
        if (status === 400 && (code === 'validation_error' || data?.code === 'validation_error')) {
          await prisma.sellerProfile.update({
            where: { userId: sellerId },
            data: {
              yandexMerchantStatus: 'validation_error',
              yandexMerchantError: details ? (typeof details === 'object' ? details : { raw: details }) : undefined
            }
          }).catch(() => undefined);
          return { status: 'validation_error', details: details ?? { message: 'Ошибка валидации при регистрации мерчанта' } };
        }
        throw err;
      }
    }

    try {
      const statusRes = await yandexDeliveryService.merchantRegistrationStatus(profile.yandexMerchantRegistrationId);
      const status = statusRes?.status ?? 'in_progress';
      const merchantId = statusRes?.merchant_id?.trim();
      const errorPayload = statusRes?.error;

      await prisma.sellerProfile.update({
        where: { userId: sellerId },
        data: {
          yandexMerchantStatus: status,
          ...(merchantId ? { yandexMerchantId: merchantId } : {}),
          yandexMerchantError: status === 'validation_error' && errorPayload
            ? (typeof errorPayload === 'object' ? errorPayload : { raw: errorPayload })
            : null
        }
      });
    } catch (err) {
      const ax = err as { response?: { status?: number; data?: unknown } };
      console.warn('[YANDEX_MERCHANT] status check failed', { sellerId, status: ax.response?.status });
      return { status: 'in_progress', message: 'Не удалось проверить статус регистрации.' };
    }

    const updated = await prisma.sellerProfile.findUnique({
      where: { userId: sellerId },
      select: { yandexMerchantId: true, yandexMerchantStatus: true, yandexMerchantError: true }
    });
    if (updated?.yandexMerchantId) {
      return { status: 'ready', merchantId: updated.yandexMerchantId };
    }
    if (updated?.yandexMerchantStatus === 'validation_error') {
      return {
        status: 'validation_error',
        details: (updated.yandexMerchantError as object) ?? { message: 'Ошибка валидации данных мерчанта' }
      };
    }
    return { status: 'in_progress', message: 'Регистрация мерчанта в процессе.' };
  }
};
