import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';
import styles from './Tabs.module.css';

interface TabsProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}

const TabButton = ({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" className={clsx(styles.tab, className)} {...props} />
);

export const Tabs = ({ options, value, onChange }: TabsProps) => {
  return (
    <div className={styles.tabs}>
      {options.map((option) => (
        <TabButton
          key={option.value}
          className={clsx({ [styles.active]: option.value === value })}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </TabButton>
      ))}
    </div>
  );
};
