import { InputHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import styles from './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: ReactNode;
  wrapperClassName?: string;
  endAdornment?: ReactNode;
}


export const Input = ({
  label,
  error,
  helperText,
  wrapperClassName,
  className,
  endAdornment,
  ...props
}: InputProps) => {
  return (
    <label className={clsx(styles.field, wrapperClassName)}>
      {label && <span className={styles.label}>{label}</span>}
      <span className={styles.control}>
        <input
          className={clsx(styles.input, className, {
            [styles.errorState]: Boolean(error),
            [styles.withAdornment]: Boolean(endAdornment)
          })}
          {...props}
        />
        {endAdornment ? <span className={styles.adornment}>{endAdornment}</span> : null}
      </span>
      {error ? <span className={styles.error}>{error}</span> : helperText && <span className={styles.helper}>{helperText}</span>}
    </label>
  );
};
