import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

type SellerDeliveryProfilePayload = {
  dropoffStationId?: string | null;
  dropoffStationMeta?: Record<string, unknown>;
  dropoffSchedule?: 'DAILY' | 'WEEKDAYS';
};

const toDto = (profile: {
  id: string;
  sellerId: string;
  dropoffStationId: string | null;
  dropoffStationMeta: unknown;
  dropoffSchedule: 'DAILY' | 'WEEKDAYS';
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: profile.id,
  sellerId: profile.sellerId,
  dropoffStationId: profile.dropoffStationId,
  dropoffStationMeta:
    profile.dropoffStationMeta && typeof profile.dropoffStationMeta === 'object' && !Array.isArray(profile.dropoffStationMeta)
      ? (profile.dropoffStationMeta as Record<string, unknown>)
      : null,
  dropoffSchedule: profile.dropoffSchedule,
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt
});

const toJsonInput = (value?: Record<string, unknown>): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!value) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
};

export const sellerDeliveryProfileService = {
  getBySellerId: async (sellerId: string) => {
    const profile = await prisma.sellerDeliveryProfile.findUnique({ where: { sellerId } });
    return profile ? toDto(profile) : null;
  },

  upsert: async (sellerId: string, payload: SellerDeliveryProfilePayload) => {
    const profile = await prisma.sellerDeliveryProfile.upsert({
      where: { sellerId },
      create: {
        sellerId,
        dropoffStationId: payload.dropoffStationId ?? null,
        dropoffStationMeta: toJsonInput(payload.dropoffStationMeta) ?? Prisma.JsonNull,
        dropoffSchedule: payload.dropoffSchedule ?? 'WEEKDAYS'
      },
      update: {
        ...(payload.dropoffStationId !== undefined ? { dropoffStationId: payload.dropoffStationId } : {}),
        ...(payload.dropoffStationMeta !== undefined ? { dropoffStationMeta: toJsonInput(payload.dropoffStationMeta) } : {}),
        ...(payload.dropoffSchedule ? { dropoffSchedule: payload.dropoffSchedule } : {})
      }
    });

    return toDto(profile);
  }
};
