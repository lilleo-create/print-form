import { SelectHTMLAttributes } from 'react';
import clsx from 'clsx';
import styles from './Select.module.css';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = ({ className, ...props }: SelectProps) => {
  return <select className={clsx(styles.select, className)} {...props} />;
};
