import { Outlet } from 'react-router-dom';
import { Header } from '../header/Header';
import { BottomNav } from './BottomNav';
import { Footer } from './Footer';
import { ProductModalHost } from '../shop/ProductModalHost';
import styles from './Layout.module.css';

export const Layout = () => {
  return (
    <div className={styles.app}>
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
      <BottomNav />
      <Footer />
      <ProductModalHost />
    </div>
  );
};
