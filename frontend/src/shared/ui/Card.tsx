import { HTMLAttributes } from 'react';
import clsx from 'clsx';
import styles from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'muted';
  padding?: 'default' | 'none';
}

export const Card = ({
  variant = 'default',
  padding = 'default',
  className,
  ...props
}: CardProps) => {
  return (
    <div
      className={clsx(styles.card, styles[variant], styles[`padding-${padding}`], className)}
      {...props}
    />
  );
};