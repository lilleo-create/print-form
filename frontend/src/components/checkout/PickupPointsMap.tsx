import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import type { PvzPoint } from '../../hooks/checkout/usePickupPoints';

function getLatLng(p: PvzPoint): { lat: number; lng: number } | null {
  const pos = p.position;
  const lat = pos?.lat ?? pos?.latitude;
  const lng = pos?.lng ?? pos?.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { lat, lng };
}

export function PickupPointsMap({
  points,
  center
}: {
  points: PvzPoint[];
  center: { lat: number; lng: number };
}) {
  return (
    <MapContainer center={center} zoom={11} style={{ height: 450, width: '100%' }}>
      <TileLayer
        // OpenStreetMap tiles
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {points.map((p) => {
        const ll = getLatLng(p);
        if (!ll) return null;

        return (
          <Marker key={String(p.id)} position={ll}>
            <Popup>
              <div style={{ maxWidth: 240 }}>
                <div><b>ПВЗ</b></div>
                <div>{p.address?.full_address ?? 'Адрес неизвестен'}</div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
