import { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useEffect } from 'react';
import { useCartStore } from '../../app/store/cartStore';
import { useAuthStore } from '../../app/store/authStore';
import { useAddressStore } from '../../app/store/addressStore';
import { AddressModal } from '../../shared/ui/address/AddressModal';
import { HeaderAddress } from '../../shared/ui/address/HeaderAddress';
import { ProductModal } from '../shop/ProductModal';
import styles from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const cartItems = useCartStore((state) => state.items);
  const { user, logout } = useAuthStore();
  const addresses = useAddressStore((state) => state.addresses);
  const selectedAddressId = useAddressStore((state) => state.selectedAddressId);
  const isModalOpen = useAddressStore((state) => state.isModalOpen);
  const loadAddresses = useAddressStore((state) => state.loadAddresses);
  const selectAddress = useAddressStore((state) => state.selectAddress);
  const addAddress = useAddressStore((state) => state.addAddress);
  const updateAddress = useAddressStore((state) => state.updateAddress);
  const removeAddress = useAddressStore((state) => state.removeAddress);
  const closeModal = useAddressStore((state) => state.closeModal);
  const resetAddresses = useAddressStore((state) => state.reset);

  useEffect(() => {
    if (user) {
      loadAddresses(user.id);
    } else {
      resetAddresses();
    }
  }, [loadAddresses, resetAddresses, user]);

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
            {user && (
              <div className={styles.addressSlot}>
                <HeaderAddress />
              </div>
            )}
            {user ? (
              <div className={styles.userInfo}>
                <span>{user.name}</span>
                <button className={styles.authLink} onClick={() => logout()}>
                  Выйти
                </button>
              </div>
            ) : (
              <Link to="/auth/login" className={styles.authLink}>
                Войти
              </Link>
            )}
            <Link to="/cart" className={styles.cartButton} aria-label="Открыть корзину">
              Корзина
              <span className={styles.cartCount}>{cartItems.length}</span>
            </Link>
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
      <ProductModal />
      {user && (
        <AddressModal
          isOpen={isModalOpen}
          addresses={addresses}
          selectedAddressId={selectedAddressId}
          userId={user.id}
          onClose={closeModal}
          onSelect={(addressId) => selectAddress(user.id, addressId)}
          onCreate={async (payload) => {
            const created = await addAddress(payload);
            await selectAddress(user.id, created.id);
            return created;
          }}
          onUpdate={updateAddress}
          onDelete={async (addressId) => {
            const nextAddresses = addresses.filter((address) => address.id !== addressId);
            await removeAddress(user.id, addressId);
            if (selectedAddressId === addressId) {
              const fallbackId = nextAddresses[0]?.id ?? '';
              if (fallbackId) {
                await selectAddress(user.id, fallbackId);
              }
            }
          }}
        />
      )}
    </div>
  );
};
