import { Link } from 'react-router-dom';
import styles from './CheckoutLegalLinks.module.css';

export const CheckoutLegalLinks = () => (
  <div className={styles.links}>
    <Link to="/privacy-policy">Условия доставки и возврата</Link>
    <Link to="/privacy-policy">О товаре и продавце</Link>
  </div>
);
