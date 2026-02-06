import { HTMLAttributes } from 'react';
import clsx from 'clsx';
import styles from './Skeleton.module.css';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'rect' | 'circle';
}

export const Skeleton = ({ variant = 'rect', className, ...props }: SkeletonProps) => {
  return <div className={clsx(styles.skeleton, styles[variant], className)} {...props} />;
};
