import { HTMLAttributes } from 'react';
import clsx from 'clsx';
import styles from './EmptyState.module.css';

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
}

export const EmptyState = ({ title, description, className, ...props }: EmptyStateProps) => {
  return (
    <div className={clsx(styles.empty, className)} {...props}>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>
  );
};
