import { Outlet } from 'react-router-dom';
import { Header } from '../header/Header';
import { BottomNav } from './BottomNav';
import { Footer } from './Footer';
import { ProductModalHost } from '../shop/ProductModalHost';
import styles from './Layout.module.css';

type LayoutProps = {
  showHeader?: boolean;
};

export const Layout = ({ showHeader = true }: LayoutProps) => {
  return (
    <div className={styles.app}>
      {showHeader ? <Header /> : null}
      <main className={styles.main}>
        <Outlet />
      </main>
      <BottomNav />
      <Footer />
      <ProductModalHost />
    </div>
  );
};
