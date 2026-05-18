import styles from '../../pages/SellerAccountPage.module.css';

type SellerHeaderProps = {
  title: string;
  subtitle?: string;
};

export const SellerHeader = ({ title, subtitle }: SellerHeaderProps) => {
  return (
    <header className={styles.pageHeader}>
      <p className={styles.pageHeaderBreadcrumb}>Кабинет продавца</p>
      <h1 className={styles.pageHeaderTitle}>{title}</h1>
      {subtitle && <p className={styles.pageHeaderSubtitle}>{subtitle}</p>}
    </header>
  );
};
