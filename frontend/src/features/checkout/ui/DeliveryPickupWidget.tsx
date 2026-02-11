import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PickupPoint } from '../api/checkoutApi';
import { loadDeliveryWidgetScript } from '../../../shared/lib/loadDeliveryWidgetScript';
import styles from './DeliveryPickupWidget.module.css';

type Props = {
  city?: string;
  onSelected: (point: PickupPoint) => void;
};

type WidgetPointDetail = {
  id: string;
  address?: {
    full_address?: string;
    country?: string;
    locality?: string;
    street?: string;
    house?: string;
    comment?: string;
  };
  type?: string;
  payment_methods?: string[];
  paymentMethods?: string[];
  position?: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const buildPickupPoint = (detail: WidgetPointDetail): PickupPoint => ({
  id: String(detail.id),
  fullAddress: detail.address?.full_address ?? '',
  country: detail.address?.country,
  locality: detail.address?.locality,
  street: detail.address?.street,
  house: detail.address?.house,
  comment: detail.address?.comment,
  type: detail.type,
  paymentMethods: detail.payment_methods ?? detail.paymentMethods ?? [],
  position: detail.position
    ? {
        lat: detail.position.lat ?? detail.position.latitude,
        lng: detail.position.lng ?? detail.position.longitude
      }
    : undefined
});

export const DeliveryPickupWidget = ({ city = 'Москва', onSelected }: Props) => {
  const reactId = useId();
  const containerId = useMemo(() => `delivery-widget-${reactId.replace(/:/g, '')}`, [reactId]);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const startWidget = () => {
      if (initializedRef.current || !window.YaDelivery) {
        return;
      }

      window.YaDelivery.createWidget({
        containerId,
        params: {
          city,
          size: {
            height: '450px',
            width: '100%'
          },
          delivery_price: 'от 100',
          delivery_term: 'от 1 дня',
          show_select_button: true,
          filter: {
            type: ['pickup_point', 'terminal'],
            is_yandex_branded: false,
            payment_methods: ['already_paid', 'card_on_receipt'],
            payment_methods_filter: 'or'
          }
        }
      });
      initializedRef.current = true;
    };

    const handleWidgetLoad = () => startWidget();
    const handlePointSelected = (event: Event) => {
      const customEvent = event as CustomEvent<WidgetPointDetail>;
      if (!customEvent.detail?.id) {
        return;
      }
      onSelected(buildPickupPoint(customEvent.detail));
    };

    document.addEventListener('YaNddWidgetLoad', handleWidgetLoad);
    document.addEventListener('YaNddWidgetPointSelected', handlePointSelected);

    loadDeliveryWidgetScript()
      .then(() => startWidget())
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить виджет.');
      });

    return () => {
      document.removeEventListener('YaNddWidgetLoad', handleWidgetLoad);
      document.removeEventListener('YaNddWidgetPointSelected', handlePointSelected);
    };
  }, [city, containerId, onSelected]);

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }

  return <div id={containerId} className={styles.widgetContainer} />;
};
