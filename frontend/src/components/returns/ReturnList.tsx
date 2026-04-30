import type { ReturnRequest } from '../../shared/types';

type ReturnListProps = {
  items: ReturnRequest[];
  isLoading?: boolean;
  error?: string | null;
};

export const ReturnList = ({ items, isLoading, error }: ReturnListProps) => {
  if (isLoading) {
    return <p style={{ color: 'var(--muted)' }}>Загрузка...</p>;
  }

  if (error) {
    return <p style={{ color: 'var(--danger)' }}>{error}</p>;
  }

  if (!items.length) {
    return <p style={{ color: 'var(--muted)' }}>Нет активных возвратов.</p>;
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
      {items.map((r) => (
        <li key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <strong>Возврат #{r.id.slice(0, 8)}</strong>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
            Статус: {r.statusLabelRu ?? r.status}
          </p>
        </li>
      ))}
    </ul>
  );
};
