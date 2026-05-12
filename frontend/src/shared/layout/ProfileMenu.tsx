import { Link } from 'react-router-dom';
import { useSwipeToClose } from '../lib/useSwipeToClose';
import styles from '../../widgets/layout/Layout.module.css';
import { useIsSeller } from '../lib/useIsSeller';
import { useAuthStore } from '../../app/store/authStore';
import { canAccessAdmin } from '../lib/authAccess';

/* ── Minimal SVG icons (1.7px stroke, consistent with header) ── */
const IcOrders = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>;
const IcBox    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>;
const IcReturn = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>;
const IcHeart  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>;
const IcSettings=()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>;
const IcTheme  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>;
const IcSeller = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IcShop   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2H3v20h18V2h-3"/><path d="M6 2a3 3 0 0 0 6 0 3 3 0 0 0 6 0"/></svg>;
const IcAdmin  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcChat   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IcPolicy = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>;
const IcLogout = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IcClose  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>;

const getInitials = (name?: string | null, email?: string | null) => {
  const src = name ?? email ?? '';
  return src.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'АМ';
};

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
  const user = useAuthStore((state) => state.user);
  const showAdminLink = canAccessAdmin(user);
  const initials = getInitials(user?.name, user?.email);
  const displayName = user?.name ?? user?.email ?? 'Профиль';

  const { panelRef, handleTouchStart, handleTouchMove, handleTouchEnd } = useSwipeToClose(onClose);

  if (!isOpen) return null;

  const isAccountTab = (tab: string) => pathname === '/account' && searchTab === tab;

  return (
    <div
      className={styles.profileMenuOverlay}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className={styles.profileMenuPage}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile: drag handle — swipe down here to close */}
        <div
          className={styles.profileMenuHandleRow}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <span className={styles.profileMenuHandleBar} />
        </div>

        {/* Header: avatar + name + close */}
        <div className={styles.profileMenuHeader}>
          <div className={styles.profileMenuHeaderUser}>
            <span className={styles.profileMenuAvatar}>{initials}</span>
            <span className={styles.profileMenuUserName}>{displayName}</span>
          </div>
          <button
            type="button"
            className={styles.profileMenuClose}
            onClick={onClose}
            aria-label="Закрыть"
          >
            <IcClose />
          </button>
        </div>

        <div className={styles.profileMenuContent}>
          <nav className={styles.profileMenuList}>

            {/* Purchases section */}
            <div className={styles.profileMenuSection}>
              <div className={styles.profileMenuSectionLabel}>Покупки</div>

              <Link to="/orders" className={`${styles.profileMenuItem} ${pathname === '/orders' ? styles.profileMenuItemActive : ''}`} onClick={onClose}>
                <span className={styles.profileMenuIcon}><IcOrders /></span>Заказы
              </Link>
              <Link to="/account?tab=purchases" className={`${styles.profileMenuItem} ${isAccountTab('purchases') ? styles.profileMenuItemActive : ''}`} onClick={onClose}>
                <span className={styles.profileMenuIcon}><IcBox /></span>Купленные товары
              </Link>
              <Link to="/account?tab=returns" className={`${styles.profileMenuItem} ${isAccountTab('returns') ? styles.profileMenuItemActive : ''}`} onClick={onClose}>
                <span className={styles.profileMenuIcon}><IcReturn /></span>Возвраты
              </Link>
              <Link to="/favorites" className={`${styles.profileMenuItem} ${pathname === '/favorites' ? styles.profileMenuItemActive : ''}`} onClick={onClose}>
                <span className={styles.profileMenuIcon}><IcHeart /></span>Избранные
              </Link>
            </div>

            {/* Account section */}
            <div className={styles.profileMenuSection}>
              <div className={styles.profileMenuSectionLabel}>Аккаунт</div>

              <Link to="/account?tab=profile" className={`${styles.profileMenuItem} ${isAccountTab('profile') ? styles.profileMenuItemActive : ''}`} onClick={onClose}>
                <span className={styles.profileMenuIcon}><IcSettings /></span>Настройки и профиль
              </Link>

              <button type="button" className={`${styles.profileMenuItem} ${styles.profileMenuToggle}`} onClick={onToggleTheme}>
                <span className={styles.profileMenuIcon}><IcTheme /></span>
                <span style={{ flex: 1 }}>Тема</span>
                <span className={styles.profileMenuToggleValue}>{theme === 'light' ? 'Светлая' : 'Тёмная'}</span>
              </button>

              <Link to={sellerCabinetLink} className={`${styles.profileMenuItem} ${pathname.startsWith('/seller') ? styles.profileMenuItemActive : ''}`} onClick={onClose}>
                <span className={styles.profileMenuIcon}><IcSeller /></span>
                {isSeller ? 'Кабинет продавца' : 'Продавайте на PrintForm'}
              </Link>

              {isSeller && (
                sellerShopLink ? (
                  <Link to={sellerShopLink} className={styles.profileMenuItem} onClick={onClose}>
                    <span className={styles.profileMenuIcon}><IcShop /></span>Ваш магазин
                  </Link>
                ) : (
                  <span className={`${styles.profileMenuItem} ${styles.profileMenuItemDisabled}`}>
                    <span className={styles.profileMenuIcon}><IcShop /></span>Ваш магазин
                  </span>
                )
              )}

              {showAdminLink && (
                <Link to="/admin" className={`${styles.profileMenuItem} ${pathname.startsWith('/admin') ? styles.profileMenuItemActive : ''}`} onClick={onClose}>
                  <span className={styles.profileMenuIcon}><IcAdmin /></span>Админ-панель
                </Link>
              )}

              <Link to="/account?tab=chats" className={`${styles.profileMenuItem} ${isAccountTab('chats') ? styles.profileMenuItemActive : ''}`} onClick={onClose}>
                <span className={styles.profileMenuIcon}><IcChat /></span>Чаты
              </Link>

              <Link to="/privacy-policy" className={`${styles.profileMenuItem} ${pathname === '/privacy-policy' ? styles.profileMenuItemActive : ''}`} onClick={onClose}>
                <span className={styles.profileMenuIcon}><IcPolicy /></span>Политика данных
              </Link>
            </div>

            {/* Logout */}
            <div className={styles.profileMenuSection}>
              <button type="button" className={`${styles.profileMenuItem} ${styles.profileMenuLogout}`} onClick={onLogout}>
                <span className={styles.profileMenuIcon}><IcLogout /></span>Выйти
              </button>
            </div>

          </nav>
        </div>
      </div>
    </div>
  );
};
