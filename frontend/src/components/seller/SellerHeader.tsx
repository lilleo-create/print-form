import styles from '../../pages/SellerAccountPage.module.css';

type SellerHeaderProps = {
  title: string;
  subtitle?: string;
  onMenuOpen: () => void;
  isMenuOpen?: boolean;
};

export const SellerHeader = ({ title, subtitle, onMenuOpen, isMenuOpen = false }: SellerHeaderProps) => {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.topBar}>
        <button
          type="button"
          className={styles.menuToggle}
          onClick={onMenuOpen}
          aria-label={isMenuOpen ? 'Закрыть меню продавца' : 'Открыть меню продавца'}
          aria-expanded={isMenuOpen}
          aria-controls="seller-sidebar"
        >
          ☰
        </button>
        <span className={styles.topBarLabel}>Кабинет продавца</span>
      </div>
      <div className={styles.pageHeaderContent}>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </header>
  );
};
