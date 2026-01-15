import { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useCartStore } from '../../app/store/cartStore';
import { useUiStore } from '../../app/store/uiStore';
import { useAuthStore } from '../../app/store/authStore';
import { CartDrawer } from '../shop/CartDrawer';
import { ProductModal } from '../shop/ProductModal';
import styles from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const cartItems = useCartStore((state) => state.items);
  const openCart = useUiStore((state) => state.openCart);
  const { user, logout } = useAuthStore();

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.logo}>
            3D Market
          </Link>
          <nav className={styles.nav}>
            <NavLink to="/" className={({ isActive }) => (isActive ? styles.active : '')}>
              Главная
            </NavLink>
            <NavLink to="/catalog" className={({ isActive }) => (isActive ? styles.active : '')}>
              Каталог
            </NavLink>
            {user && (
              <NavLink to="/account" className={({ isActive }) => (isActive ? styles.active : '')}>
                Кабинет
              </NavLink>
            )}
            {user?.role === 'seller' && (
              <NavLink to="/seller" className={({ isActive }) => (isActive ? styles.active : '')}>
                Продавец
              </NavLink>
            )}
          </nav>
          <div className={styles.actions}>
            {user ? (
              <div className={styles.userInfo}>
                <span>{user.name}</span>
                <button className={styles.authLink} onClick={() => logout()}>
                  Выйти
                </button>
              </div>
            ) : (
              <Link to="/auth" className={styles.authLink}>
                Войти
              </Link>
            )}
            <button className={styles.cartButton} onClick={openCart} aria-label="Открыть корзину">
              Корзина
              <span className={styles.cartCount}>{cartItems.length}</span>
            </button>
          </div>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <div>
          <h4>3D Печать маркетплейс</h4>
          <p>Сервис изготовления, покупки и кастомной печати моделей.</p>
        </div>
        <div>
          <h5>Контакты</h5>
          <p>support@3dmarket.ru</p>
          <p>+7 (800) 555-15-15</p>
        </div>
        <div>
          <h5>Сервисы</h5>
          <p>Каталог</p>
          <p>Кастомная печать</p>
          <p>Личный кабинет</p>
        </div>
      </footer>
      <CartDrawer />
      <ProductModal />
    </div>
  );
};
