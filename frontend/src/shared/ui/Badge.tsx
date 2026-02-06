import { HTMLAttributes } from 'react';
import clsx from 'clsx';
import styles from './Badge.module.css';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

export const Badge = ({ variant = 'default', className, ...props }: BadgeProps) => {
  return <span className={clsx(styles.badge, styles[variant], className)} {...props} />;
};
