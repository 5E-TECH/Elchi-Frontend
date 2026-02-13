import { useState, useMemo } from 'react';
import styles from './Table.module.css';
import type { TableProps, ColumnConfig, SortConfig } from './Table.types';

export const Table = <T extends Record<string, any>>({
  data,
  columns,
  keyExtractor = (_, index) => index,
  loading = false,
  emptyMessage = "Ma'lumot topilmadi",
  onRowClick,
  className = '',
  striped = true,
  bordered = true,
  hoverable = true,
}: TableProps<T>) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // Sorting logikasi
  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    const sorted = [...data].sort((a, b) => {
      const aValue = a[sortConfig.key as keyof T];
      const bValue = b[sortConfig.key as keyof T];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue as string)
          : (bValue as string).localeCompare(aValue);
      }

      if (typeof aValue === 'number') {
        return sortConfig.direction === 'asc'
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }

      return 0;
    });

    return sorted;
  }, [data, sortConfig]);

  const handleSort = (column: ColumnConfig<T>) => {
    if (!column.sortable) return;

    const key = String(column.key);
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === 'asc'
          ? { key, direction: 'desc' }
          : null;
      }
      return { key, direction: 'asc' };
    });
  };

  const tableClassName = [
    styles.table,
    striped && styles.striped,
    bordered && styles.bordered,
    hoverable && styles.hoverable,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (loading) {
    return <div className={styles.loading}>Yuklanmoqda...</div>;
  }

  if (data.length === 0) {
    return <div className={styles.empty}>{emptyMessage}</div>;
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={tableClassName}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                style={{ width: column.width }}
                onClick={() => handleSort(column)}
                className={column.sortable ? styles.sortable : ''}
              >
                <div className={styles.headerContent}>
                  <span>{column.label}</span>
                  {column.sortable && (
                    <span className={styles.sortIndicator}>
                      {sortConfig?.key === String(column.key) && (
                        sortConfig.direction === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIndex) => (
            <tr
              key={keyExtractor(row, rowIndex)}
              onClick={() => onRowClick?.(row, rowIndex)}
              className={onRowClick ? styles.clickable : ''}
            >
              {columns.map((column) => (
                <td
                  key={String(column.key)}
                  className={column.className}
                >
                  {column.render
                    ? column.render(row[column.key], row, rowIndex)
                    : String(row[column.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};