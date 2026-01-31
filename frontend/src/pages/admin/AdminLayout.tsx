import { NavLink, Outlet } from 'react-router-dom';
import styles from './AdminLayout.module.css';

const navItems = [
  { to: '/admin/kyc', label: 'KYC' },
  { to: '/admin/products', label: 'Товары' },
  { to: '/admin/reviews', label: 'Отзывы' }
];

export const AdminLayout = () => {
  return (
    <section className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <h2 className={styles.sidebarTitle}>Админ-панель</h2>
          <nav className={styles.nav}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </section>
  );
};
