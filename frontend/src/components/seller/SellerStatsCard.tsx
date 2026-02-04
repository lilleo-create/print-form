import styles from '../../pages/SellerAccountPage.module.css';

type SellerStatsCardProps = {
  title: string;
  value: string;
};

export const SellerStatsCard = ({ title, value }: SellerStatsCardProps) => {
  return (
    <div className={styles.statCard}>
      <h3>{title}</h3>
      <p>{value}</p>
    </div>
  );
};
