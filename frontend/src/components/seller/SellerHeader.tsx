import styles from '../../pages/SellerAccountPage.module.css';

type SellerHeaderProps = {
  title: string;
  subtitle?: string;
};

export const SellerHeader = ({ title, subtitle }: SellerHeaderProps) => {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeaderContent}>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </header>
  );
};
