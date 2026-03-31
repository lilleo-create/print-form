import { ReactNode } from 'react';

type SellerFinanceTableProps<T> = {
  columns: Array<{ key: string; title: string; render: (row: T) => ReactNode }>;
  rows: T[];
  rowKey: (row: T) => string;
  headerClassName: string;
  rowClassName: string;
  desktopContainerClassName: string;
  templateClassName: string;
};

export const SellerFinanceTable = <T,>({
  columns,
  rows,
  rowKey,
  headerClassName,
  rowClassName,
  desktopContainerClassName,
  templateClassName
}: SellerFinanceTableProps<T>) => (
  <div className={desktopContainerClassName}>
    <div className={`${headerClassName} ${templateClassName}`}>
      {columns.map((column) => (
        <span key={column.key}>{column.title}</span>
      ))}
    </div>
    {rows.map((row) => (
      <div key={rowKey(row)} className={`${rowClassName} ${templateClassName}`}>
        {columns.map((column) => (
          <span key={`${rowKey(row)}-${column.key}`} data-title={column.title}>
            {column.render(row)}
          </span>
        ))}
      </div>
    ))}
  </div>
);
