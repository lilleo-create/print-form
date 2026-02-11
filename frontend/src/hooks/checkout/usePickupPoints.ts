import { useYandexPvz, type YandexPvzPoint } from '../../components/checkout/hooks/useYandexPvz';

export type PvzPoint = YandexPvzPoint;

export function usePickupPoints(city: string) {
  return useYandexPvz({ city, query: '', enabled: true });
}
