import { useEffect, useMemo, useRef, useState } from 'react';
import { SellerDropoffMap } from '../SellerDropoffMap';
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
  const [searchEmptyMessage, setSearchEmptyMessage] = useState<string | null>(null);
  const [detectedGeoId, setDetectedGeoId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const selectedStation = useMemo(
    () => stations.find((station) => station.id === selectedId) ?? null,
    [stations, selectedId]
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return stations;
    return stations.filter((station) => {
      const haystack = `${station.name ?? ''} ${station.addressFull ?? ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [stations, query]);

  const runSearch = async (rawQuery: string) => {
    const normalizedQuery = rawQuery.trim();
    if (normalizedQuery.length < 2) {
      setStations([]);
      setSearchEmptyMessage(null);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await api.searchSellerDropoffStations(normalizedQuery, 213, 50, controller.signal);
      const points = response.data?.points ?? [];
      setStations(points);
      setSelectedId((prev) => (prev && points.some((point) => point.id === prev) ? prev : points[0]?.id ?? null));
      setDetectedGeoId(response.data?.debug?.geoId ?? null);
      setSearchEmptyMessage(points.length ? null : 'Пункты приёма не найдены. Уточните запрос.');
    } catch (e) {
      if (controller.signal.aborted) {
        return;
      }
      const normalized = normalizeApiError(e);
      setError(normalized.message ?? 'Не удалось выполнить поиск пунктов приёма.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      abortRef.current?.abort();
      return;
    }

    const timeout = window.setTimeout(() => {
      void runSearch(query);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [isOpen, query]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>Пункты приёма (как физлицо)</h3>
          <Button type="button" variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>

        <div className={styles.actions}>
          <input
            className={styles.search}
            placeholder="Введите город, район или адрес (например, Тушино)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button type="button" onClick={() => void runSearch(query)} disabled={loading}>
            {loading ? 'Поиск…' : 'Найти'}
          </Button>
        </div>

        <p className={styles.muted}>Показываем пункты приёма для сдачи C2C (физлицо). geoId: {detectedGeoId ?? geoId}</p>

        {error && <p className={styles.error}>{error}</p>}
        {!error && searchEmptyMessage && <p className={styles.muted}>{searchEmptyMessage}</p>}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            height: 420
          }}
        >
          <div style={{ overflow: 'auto' }}>
            {filtered.length === 0 ? (
              <p className={styles.muted}>Пункты приёма не найдены.</p>
            ) : (
              filtered.map((station) => {
                const active = station.id === selectedId;

                return (
                  <button
                    key={station.id}
                    type="button"
                    onClick={() => setSelectedId(station.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: 12,
                      border: 'none',
                      background: active ? '#f3f3f3' : 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{station.name ?? 'Пункт выдачи'}</div>

                    <div style={{ fontSize: 13, opacity: 0.7 }}>
                      {station.addressFull ?? 'Адрес не указан'}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div style={{ height: '100%', borderRadius: 12, overflow: 'hidden' }}>
            <SellerDropoffMap points={filtered} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        </div>

        <div className={styles.footerActions}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="button"
            onClick={() => selectedStation && onSelect(selectedStation)}
            disabled={!selectedStation}
          >
            Выбрать пункт
          </Button>
        </div>
      </div>
    </div>
  );
};
