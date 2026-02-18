import { useMemo, useState } from 'react';
import { api, type SellerDropoffStation } from '../../shared/api/api';
import { normalizeApiError } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import styles from './SellerDropoffStationPicker.module.css';

type Props = {
  isOpen: boolean;
  geoId: number;
  onClose: () => void;
  onSelect: (station: SellerDropoffStation) => void;
};

export const SellerDropoffStationPicker = ({ isOpen, geoId, onClose, onSelect }: Props) => {
  const [stations, setStations] = useState<SellerDropoffStation[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getSellerDropoffStations(geoId, 100);
      setStations(response.data?.points ?? []);
    } catch (e) {
      const normalized = normalizeApiError(e);
      setError(normalized.message ?? 'Не удалось загрузить станции сдачи.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return stations;
    return stations.filter((station) => {
      const haystack = `${station.name ?? ''} ${station.addressFull ?? ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [stations, query]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>Станция сдачи (warehouse)</h3>
          <Button type="button" variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>

        <div className={styles.actions}>
          <Button type="button" onClick={loadStations} disabled={loading}>
            {loading ? 'Загрузка…' : 'Загрузить станции'}
          </Button>
          <input
            className={styles.search}
            placeholder="Поиск по названию или адресу"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.body}>
          <div className={styles.list}>
            {filtered.length === 0 ? (
              <p className={styles.muted}>Станции не найдены.</p>
            ) : (
              filtered.map((station) => (
                <button
                  key={station.id}
                  type="button"
                  className={styles.stationButton}
                  onClick={() => onSelect(station)}
                >
                  <strong>{station.name ?? 'Без названия'}</strong>
                  <span>{station.addressFull ?? station.id}</span>
                </button>
              ))
            )}
          </div>
          <div className={styles.mapPlaceholder}>
            Карта будет добавлена позже. Сейчас доступен стабильный выбор из списка.
          </div>
        </div>
      </div>
    </div>
  );
};
