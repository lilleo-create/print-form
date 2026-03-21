import { InputHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import styles from './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: ReactNode;
  wrapperClassName?: string;
}

export const Input = ({
  label,
  error,
  helperText,
  wrapperClassName,
  className,
  ...props
}: InputProps) => {
  return (
    <label className={clsx(styles.field, wrapperClassName)}>
      {label && <span className={styles.label}>{label}</span>}
      <input className={clsx(styles.input, className, { [styles.errorState]: Boolean(error) })} {...props} />
      {error ? <span className={styles.error}>{error}</span> : helperText && <span className={styles.helper}>{helperText}</span>}
    </label>
  );
};
