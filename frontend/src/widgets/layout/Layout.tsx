import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { Header } from '../header/Header';
import { BottomNav } from './BottomNav';
import { Footer } from './Footer';
import { ProductModalHost } from '../shop/ProductModalHost';
import { CancelOrderModalHost } from '../../components/orders/CancelOrderModalHost';
import { ProfileMenu } from '../../shared/layout/ProfileMenu';
import { useHeaderMenuStore } from '../../app/store/headerMenuStore';
import { useThemeStore } from '../../app/store/themeStore';
import { useBodyScrollLock } from '../../shared/lib/useBodyScrollLock';
import styles from './Layout.module.css';

type LayoutProps = {
  showHeader?: boolean;
};

export const Layout = ({ showHeader = true }: LayoutProps) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { theme, toggleTheme } = useThemeStore();
  const isProfileMenuOpen = useHeaderMenuStore((s) => s.isProfileMenuOpen);
  const closeProfileMenu = useHeaderMenuStore((s) => s.closeProfileMenu);

  useBodyScrollLock(isProfileMenuOpen);

  const handleLogout = () => {
    window.dispatchEvent(new Event('auth:logout'));
    closeProfileMenu();
  };

  return (
    <div className={styles.app}>
      {showHeader ? <Header /> : null}
      <main className={styles.main} data-route-scroll-root>
        <Outlet />
      </main>
      <BottomNav />
      <Footer />
      <ProductModalHost />
      <CancelOrderModalHost />
      <ProfileMenu
        isOpen={isProfileMenuOpen}
        pathname={location.pathname}
        searchTab={searchParams.get('tab')}
        onClose={closeProfileMenu}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    </div>
  );
};
