import { useEffect, useState } from 'react';
import { usePickupPoints } from '../../../hooks/checkout/usePickupPoints';
import { PickupPointsMap } from '../../../components/checkout/PickupPointsMap';

export const DeliveryPickupWidget = ({ city = 'Москва' }: { city?: string }) => {
  const { points, loading, error } = usePickupPoints(city);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({ lat: 55.7558, lng: 37.6176 });

  // если пришли точки, центрируемся по первой
  useEffect(() => {
    const p = points[0];
    const pos = p?.position;
    const lat = pos?.lat ?? pos?.latitude;
    const lng = pos?.lng ?? pos?.longitude;
    if (typeof lat === 'number' && typeof lng === 'number') {
      setCenter({ lat, lng });
    }
  }, [points]);

  if (loading) return <div>Загрузка ПВЗ…</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

  return (
    <div>
      <PickupPointsMap points={points} center={center} />
      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        Найдено точек: {points.length}
      </div>
    </div>
  );
};
