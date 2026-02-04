import styles from '../../pages/SellerAccountPage.module.css';

type SellerHeaderProps = {
  title: string;
  onMenuOpen: () => void;
};

export const SellerHeader = ({ title, onMenuOpen }: SellerHeaderProps) => {
  return (
    <div className={styles.topBar}>
      <button type="button" className={styles.menuToggle} onClick={onMenuOpen}>
        ☰
      </button>
      <div>
        <h1>{title}</h1>
        <p>Раздел продавца PrintForm.</p>
      </div>
    </div>
  );
};
