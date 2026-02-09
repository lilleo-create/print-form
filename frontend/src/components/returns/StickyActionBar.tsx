import { ReactNode } from 'react';
import styles from './StickyActionBar.module.css';

interface StickyActionBarProps {
  children: ReactNode;
}

export const StickyActionBar = ({ children }: StickyActionBarProps) => (
  <div className={styles.bar}>
    <div className={styles.content}>{children}</div>
  </div>
);
