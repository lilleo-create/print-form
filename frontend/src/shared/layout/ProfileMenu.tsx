import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from '../../widgets/layout/Layout.module.css';
import { useIsSeller } from '../lib/useIsSeller';

type Props = {
  isOpen: boolean;
  pathname: string;
  searchTab: string | null;
  onClose: () => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
};

export const ProfileMenu = ({
  isOpen,
  pathname,
  searchTab,
  onClose,
  onLogout,
  theme,
  onToggleTheme
}: Props) => {
  const { isSeller, sellerCabinetLink, sellerShopLink } = useIsSeller();


  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const CONTENT_MAX = 1120;
    const SIDE_PAD = 16;

    const updateGutter = () => {
      const width = window.innerWidth;
      const containerWidth = Math.min(CONTENT_MAX, width);
      const gutter = Math.max(SIDE_PAD, Math.floor((width - containerWidth) / 2) - SIDE_PAD);
      document.documentElement.style.setProperty('--container-gutter', `${gutter}px`);
    };

    updateGutter();
    window.addEventListener('resize', updateGutter);
    return () => window.removeEventListener('resize', updateGutter);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={styles.profileMenuOverlay}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className={styles.profileMenuPage} onClick={(event) => event.stopPropagation()}>
        <div className={styles.profileMenuHeader}>
          <span>Меню</span>
          <button
            type="button"
            className={styles.profileMenuClose}
            onClick={onClose}
            aria-label="Закрыть меню"
          >
            ✕
          </button>
        </div>
        <div className={styles.profileMenuContent}>
          <nav className={styles.profileMenuList}>
            <div className={styles.profileMenuSection}>
              <div className={styles.profileMenuSectionLabel}>Покупки</div>
              <Link
                to="/orders"
                className={`${styles.profileMenuItem} ${pathname === '/orders' ? styles.profileMenuItemActive : ''}`}
                onClick={onClose}
              >
                <span className={styles.profileMenuIcon} aria-hidden>🧾</span>
                <span className={styles.profileMenuText}>Заказы</span>
              </Link>
              <Link
                to="/account?tab=purchases"
                className={`${styles.profileMenuItem} ${pathname === '/account' && searchTab === 'purchases' ? styles.profileMenuItemActive : ''}`}
                onClick={onClose}
              >
                <span className={styles.profileMenuIcon} aria-hidden>📦</span>
                <span className={styles.profileMenuText}>Купленные товары</span>
              </Link>
              <Link
                to="/account?tab=returns"
                className={`${styles.profileMenuItem} ${pathname === '/account' && searchTab === 'returns' ? styles.profileMenuItemActive : ''}`}
                onClick={onClose}
              >
                <span className={styles.profileMenuIcon} aria-hidden>↩️</span>
                <span className={styles.profileMenuText}>Возвраты</span>
              </Link>
              <Link
                to="/favorites"
                className={`${styles.profileMenuItem} ${pathname === '/favorites' ? styles.profileMenuItemActive : ''}`}
                onClick={onClose}
              >
                <span className={styles.profileMenuIcon} aria-hidden>❤</span>
                <span className={styles.profileMenuText}>Избранные</span>
              </Link>
            </div>

            <div className={styles.profileMenuSection}>
              <div className={styles.profileMenuSectionLabel}>Настройки</div>
              <Link
                to="/account?tab=profile"
                className={`${styles.profileMenuItem} ${pathname === '/account' && (!searchTab || searchTab === 'profile') ? styles.profileMenuItemActive : ''}`}
                onClick={onClose}
              >
                <span className={styles.profileMenuIcon} aria-hidden>👤</span>
                <span className={styles.profileMenuText}>Профиль</span>
              </Link>

              <button type="button" className={`${styles.profileMenuItem} ${styles.profileMenuToggle}`} onClick={onToggleTheme}>
                <span className={styles.profileMenuIcon} aria-hidden>🎨</span>
                <span className={styles.profileMenuText}>Тема оформления</span>
                <span className={styles.profileMenuToggleValue}>{theme === 'light' ? 'Светлая' : 'Тёмная'}</span>
              </button>

              <Link
                to={sellerCabinetLink}
                className={`${styles.profileMenuItem} ${pathname.startsWith('/seller') ? styles.profileMenuItemActive : ''}`}
                onClick={onClose}
              >
                <span className={styles.profileMenuIcon} aria-hidden>🧑‍💼</span>
                <span className={styles.profileMenuText}>{isSeller ? 'Кабинет продавца' : 'Продавайте на PrintForm'}</span>
              </Link>

              {isSeller ? (
                sellerShopLink ? (
                  <Link to={sellerShopLink} className={styles.profileMenuItem} onClick={onClose}>
                    <span className={styles.profileMenuIcon} aria-hidden>🏪</span>
                    <span className={styles.profileMenuText}>Ваш магазин</span>
                  </Link>
                ) : (
                  <span className={`${styles.profileMenuItem} ${styles.profileMenuItemDisabled}`}>
                    <span className={styles.profileMenuIcon} aria-hidden>🏪</span>
                    <span className={styles.profileMenuText}>Ваш магазин</span>
                  </span>
                )
              ) : null}

              <Link
                to="/account?tab=chats"
                className={`${styles.profileMenuItem} ${pathname === '/account' && searchTab === 'chats' ? styles.profileMenuItemActive : ''}`}
                onClick={onClose}
              >
                <span className={styles.profileMenuIcon} aria-hidden>💬</span>
                <span className={styles.profileMenuText}>Чаты (наше с поддержкой и продавцом)</span>
              </Link>

              <Link
                to="/privacy-policy"
                className={`${styles.profileMenuItem} ${pathname === '/privacy-policy' ? styles.profileMenuItemActive : ''}`}
                onClick={onClose}
              >
                <span className={styles.profileMenuIcon} aria-hidden>ℹ️</span>
                <span className={styles.profileMenuText}>О сервисе</span>
              </Link>
            </div>

            <div className={styles.profileMenuSection}>
              <button type="button" className={`${styles.profileMenuItem} ${styles.profileMenuLogout}`} onClick={onLogout}>
                <span className={styles.profileMenuIcon} aria-hidden>⎋</span>
                <span className={styles.profileMenuText}>Выйти</span>
              </button>
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
};
