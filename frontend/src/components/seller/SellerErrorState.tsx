import styles from '../../pages/SellerAccountPage.module.css';

type SellerErrorStateProps = {
  message: string;
};

export const SellerErrorState = ({ message }: SellerErrorStateProps) => {
  return (
    <div className={styles.section}>
      <p className={styles.error}>Не удалось проверить профиль продавца: {message}</p>
    </div>
  );
};
