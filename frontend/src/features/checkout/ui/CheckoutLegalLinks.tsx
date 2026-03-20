import { Link } from 'react-router-dom';
import styles from './CheckoutLegalLinks.module.css';

type CheckoutLegalLinksProps = {
  accepted: boolean;
  onAcceptedChange: (value: boolean) => void;
};

export const CheckoutLegalLinks = ({
  accepted,
  onAcceptedChange
}: CheckoutLegalLinksProps) => (
  <div className={styles.wrapper}>
    <label className={styles.checkboxLabel}>
      <input
        type="checkbox"
        checked={accepted}
        onChange={(event) => onAcceptedChange(event.target.checked)}
      />
      <span>
        Я ознакомился и принимаю{' '}
        <Link to="/service-rules">Правила использования сервиса</Link> и{' '}
        <Link to="/privacy-policy">Политику обработки персональных данных</Link>
      </span>
    </label>
    <div className={styles.links}>
      <Link to="/offer">Оферта</Link>
      <Link to="/service-rules">Правила использования сервиса</Link>
      <Link to="/privacy-policy">Политика обработки персональных данных</Link>
    </div>
  </div>
);
