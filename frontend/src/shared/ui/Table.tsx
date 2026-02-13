import { HTMLAttributes } from 'react';
import clsx from 'clsx';
import styles from './Table.module.css';

interface TableProps extends HTMLAttributes<HTMLDivElement> {}

export const Table = ({ className, ...props }: TableProps) => {
  return <div className={clsx(styles.table, className)} {...props} />;
};
