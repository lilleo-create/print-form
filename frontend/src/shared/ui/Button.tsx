import { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
}

export const Button = ({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) => {
  return (
    <button
      className={clsx(styles.button, styles[variant], styles[size], className)}
      {...props}
    />
  );
};
