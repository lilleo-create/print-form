import { ReactNode } from 'react';

type SellerFinanceMobileCardProps<T> = {
  rows: T[];
  rowKey: (row: T) => string;
  cardClassName: string;
  cardsContainerClassName: string;
  labelClassName?: string;
  fields: Array<{ key: string; label: string; render: (row: T) => ReactNode }>;
};

export const SellerFinanceMobileCard = <T,>({
  rows,
  rowKey,
  cardClassName,
  cardsContainerClassName,
  labelClassName,
  fields
}: SellerFinanceMobileCardProps<T>) => (
  <div className={cardsContainerClassName}>
    {rows.map((row) => (
      <div className={cardClassName} key={`${rowKey(row)}-mobile`}>
        {fields.map((field) => (
          <p key={`${rowKey(row)}-${field.key}`}>
            <span className={labelClassName}>{field.label}: </span>
            {field.render(row)}
          </p>
        ))}
      </div>
    ))}
  </div>
);
