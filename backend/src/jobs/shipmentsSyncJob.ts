import { yandexNddShipmentOrchestrator } from '../services/yandexNddShipmentOrchestrator';

const SYNC_INTERVAL_MS = 15 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;

export const runShipmentsSyncJob = async () => {
  return yandexNddShipmentOrchestrator.syncStatuses();
};

export const startShipmentsSyncJob = () => {
  if (timer) return;

  timer = setInterval(() => {
    runShipmentsSyncJob()
      .then((result) => {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[SHIPMENTS_SYNC_JOB]', result);
        }
      })
      .catch((error) => {
        console.error('[SHIPMENTS_SYNC_JOB] failed', error);
      });
  }, SYNC_INTERVAL_MS);
};
