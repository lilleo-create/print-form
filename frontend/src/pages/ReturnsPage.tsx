// frontend/src/pages/ReturnsPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../app/store/authStore';
import { api } from '../shared/api';
import { ReturnRequest } from '../shared/types';
import { Button } from '../shared/ui/Button';
import { ReturnList } from '../components/returns/ReturnList';
import styles from './ReturnsPage.module.css';

export const ReturnsPage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnsError, setReturnsError] = useState<string | null>(null);

  const loadReturns = () => {
    if (!user) return Promise.resolve();
    setReturnsLoading(true);
    setReturnsError(null);

    return api.returns
      .listMy()
      .then((response) => setReturns(response.data ?? []))
      .catch(() => {
        setReturns([]);
        setReturnsError('Не удалось загрузить возвраты.');
      })
      .finally(() => setReturnsLoading(false));
  };

  useEffect(() => {
    if (!user) return;
    loadReturns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) {
    return (
      <section className={styles.page}>
        <div className="container">
          <p className={styles.empty}>Войдите в аккаунт, чтобы управлять возвратами.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1>Возвраты</h1>

          <Button
            type="button"
            onClick={() => navigate('/account/returns/create')}
          >
            Вернуть товар
          </Button>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Мои заявки</h2>
            <Button type="button" variant="secondary" onClick={() => loadReturns()}>
              Обновить
            </Button>
          </div>

          <ReturnList items={returns} isLoading={returnsLoading} error={returnsError} />
        </div>
      </div>
    </section>
  );
};
