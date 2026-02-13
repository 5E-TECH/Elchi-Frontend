import { useState, useMemo } from 'react';
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
//   bordered = false,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white dark:bg-slate-950 rounded-lg border border-gray-200 dark:border-slate-700">
        <p className="text-gray-600 dark:text-slate-400">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-950">
      <table className={`w-full border-collapse ${className}`}>
        <thead>
          <tr className="border-b border-gray-200 dark:border-slate-700" style={{
            background: 'linear-gradient(90deg, #576adb 0%, #4c5798 100%)'
          }}>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                style={{ width: column.width }}
                onClick={() => handleSort(column)}
                className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-white ${
                  column.sortable ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{column.label}</span>
                  {column.sortable && (
                    <span className="text-white text-xs opacity-80">
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
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-12 text-center dark:bg-primary text-gray-600 dark:text-slate-400">
                <p>{emptyMessage}</p>
              </td>
            </tr>
          ) : (
            sortedData.map((row, rowIndex) => (
              <tr
                key={keyExtractor(row, rowIndex)}
                onClick={() => onRowClick?.(row, rowIndex)}
                className={`border-b ${
                  hoverable ? 'hover:opacity-80 transition-opacity' : ''
                } ${onRowClick ? 'cursor-pointer' : ''} ${
                  striped && rowIndex % 2 === 0 
                    ? 'bg-white dark:bg-slate-950 border-gray-200 dark:border-slate-700' 
                    : 'bg-gray-50 dark:bg-slate-900/40 border-gray-200 dark:border-slate-800'
                }`}
                style={
                  !striped || rowIndex % 2 !== 0 ? {} : {
                    backgroundImage: 'linear-gradient(to right, rgba(76, 87, 152, 0.05), rgba(87, 106, 219, 0.05))'
                  }
                }
              >
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className={`px-6 py-4 text-sm text-gray-900 dark:text-slate-100 ${column.className || ''}`}
                  >
                    {column.render
                      ? column.render(row[column.key], row, rowIndex)
                      : String(row[column.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};