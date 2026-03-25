import { Link, NavLink, Outlet } from 'react-router-dom';
import styles from './AdminLayout.module.css';

const navItems = [
  { to: '/admin/kyc', label: 'KYC' },
  { to: '/admin/products', label: 'Товары' },
  { to: '/admin/reviews', label: 'Отзывы' },
  { to: '/admin/chats', label: 'Чат' }
];

export const AdminLayout = () => {
  return (
    <section className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2 className={styles.sidebarTitle}>Админ-панель</h2>
            <Link to="/" className={styles.homeLink}>
              Вернуться на главную
            </Link>
          </div>
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
        <div className={styles.content} data-route-scroll-root>
          <Outlet />
        </div>
      </div>
    </section>
  );
};
