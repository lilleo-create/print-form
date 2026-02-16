import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

type SellerDeliveryProfilePayload = {
  dropoffStationId: string;
  dropoffStationMeta?: Record<string, unknown>;
};

const toDto = (profile: {
  id: string;
  sellerId: string;
  dropoffStationId: string;
  dropoffStationMeta: unknown;
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
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt
});

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
        dropoffStationId: payload.dropoffStationId,
        dropoffStationMeta: payload.dropoffStationMeta ? (payload.dropoffStationMeta as Prisma.InputJsonValue) : Prisma.JsonNull
      },
      update: {
        dropoffStationId: payload.dropoffStationId,
        dropoffStationMeta: payload.dropoffStationMeta ? (payload.dropoffStationMeta as Prisma.InputJsonValue) : Prisma.JsonNull
      }
    });

    return toDto(profile);
  }
};
