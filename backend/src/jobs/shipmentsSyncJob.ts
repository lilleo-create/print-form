import { prisma } from '../lib/prisma';
import { yandexDeliveryService } from '../services/yandexDeliveryService';
import { payoutService } from '../services/payoutService';

const SYNC_INTERVAL_MS = 10 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;

const mapStatus = (status?: string | null) => {
  if (!status) return null;
  if (status === 'DELIVERY_DELIVERED' || status === 'DELIVERY_TRANSMITTED_TO_RECIPIENT') return 'DELIVERED';
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status.startsWith('RETURN_') || status.startsWith('SORTING_CENTER_RETURN_')) return 'RETURNED';
  return 'IN_TRANSIT';
};

export const runShipmentsSyncJob = async () => {
  const orders = await prisma.order.findMany({
    where: {
      yandexRequestId: { not: null },
      status: { notIn: ['DELIVERED', 'CANCELLED', 'RETURNED'] }
    }
  });

  for (const order of orders) {
    if (!order.yandexRequestId) continue;
    const info = await yandexDeliveryService.getRequestInfo(order.yandexRequestId);
    const history = await yandexDeliveryService.getRequestHistory(order.yandexRequestId);
    const nextStatus = (info as Record<string, unknown> | null)?.status as string | undefined;

    if (nextStatus && nextStatus !== order.yandexStatus) {
      await prisma.orderDeliveryEvent.create({
        data: {
          orderId: order.id,
          provider: 'YANDEX',
          status: nextStatus,
          description: (info as Record<string, unknown> | null)?.description as string | undefined,
          reason: (info as Record<string, unknown> | null)?.reason as string | undefined,
          timestampUnix: (info as Record<string, unknown> | null)?.timestamp as number | undefined,
          timestampUtc: (info as Record<string, unknown> | null)?.timestamp_utc as string | undefined,
          raw: ((history ?? info ?? {}) as object)
        }
      });
    }

    const internal = mapStatus(nextStatus);
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          yandexStatus: nextStatus,
          ...(internal ? { status: internal as 'DELIVERED' | 'CANCELLED' | 'RETURNED' | 'IN_TRANSIT' } : {}),
          ...(internal === 'CANCELLED' || internal === 'RETURNED' ? { payoutStatus: 'BLOCKED' } : {})
        }
      });

      if (internal === 'DELIVERED') {
        await payoutService.releaseForDeliveredOrder(order.id, tx as any);
      }
    });
  }

  return { total: orders.length };
};

export const runShipmentSlaJob = async () => {
  await prisma.order.updateMany({
    where: {
      status: 'READY_FOR_SHIPMENT',
      dropoffDeadlineAt: { lt: new Date() },
      OR: [{ yandexRequestId: null }, { yandexStatus: null }, { yandexStatus: { in: ['DRAFT', 'CREATED'] } }]
    },
    data: { status: 'EXPIRED' }
  });
};

export const startShipmentsSyncJob = () => {
  if (timer) return;

  timer = setInterval(() => {
    runShipmentsSyncJob().catch((error) => {
      console.error('[SHIPMENTS_SYNC_JOB] failed', error);
    });
    runShipmentSlaJob().catch((error) => {
      console.error('[SHIPMENT_SLA_JOB] failed', error);
    });
  }, SYNC_INTERVAL_MS);
};
