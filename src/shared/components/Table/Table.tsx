import { useState, useMemo, useEffect, useRef, memo, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { TableProps, ColumnConfig, SortConfig } from './Table.types';

export const Table = memo(<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor = (_, index) => index,
  loading = false,
  emptyMessage = "Ma'lumot topilmadi",
  onRowClick,
  className = '',
  dense = false,
  striped = true,
  bordered = true,
  hoverable = true,
}: TableProps<T>) => {
  const { t } = useTranslation("common");
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    const updateWidth = () => {
      setContainerWidth(element.clientWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const responsiveMode = useMemo(() => {
    if (containerWidth > 0 && containerWidth < 860) {
      return 'cards' as const;
    }

    if (containerWidth > 0 && containerWidth < 1220) {
      return 'compact' as const;
    }

    return 'table' as const;
  }, [containerWidth]);

  const isCardMode = responsiveMode === 'cards';
  const isCompactMode = responsiveMode === 'compact';

  const headerCellClass = dense || isCompactMode
    ? 'px-3 py-3 text-[11px]'
    : 'px-6 py-4';
  const bodyCellClass = dense || isCompactMode
    ? 'px-3 py-3 text-[13px]'
    : 'px-6 py-4 text-sm';

  // Sorting logikasi
  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    const activeColumn = columns.find(
      (column) => String(column.key) === sortConfig.key,
    );

    const sorted = [...data].sort((a, b) => {
      const aValue = activeColumn?.sortValue
        ? activeColumn.sortValue(a)
        : a[sortConfig.key as keyof T];
      const bValue = activeColumn?.sortValue
        ? activeColumn.sortValue(b)
        : b[sortConfig.key as keyof T];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string') {
        const aString = String(aValue);
        const bString = String(bValue);

        return sortConfig.direction === 'asc'
          ? aString.localeCompare(bString)
          : bString.localeCompare(aString);
      }

      if (typeof aValue === 'number') {
        return sortConfig.direction === 'asc'
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }

      return 0;
    });

    return sorted;
  }, [columns, data, sortConfig]);

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
      <div
        className="flex items-center justify-center rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-12 dark:border-primarydark/60 dark:bg-maindark"
      >
        <p className="text-sm font-medium text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
          {t("loading")}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={`overflow-hidden rounded-2xl bg-primary shadow-sm dark:bg-maindark ${bordered ? 'border border-[color:var(--color-border-soft)] dark:border-primarydark/60' : ''}`}
    >
      <div className="overflow-x-auto custom-scrollbar">
        <table className={`w-full min-w-full border-collapse ${isCompactMode ? 'table-fixed' : ''} ${className}`}>
          <thead className={isCardMode ? 'hidden' : 'table-header-group'}>
            <tr style={{
              background:
                'linear-gradient(90deg, var(--color-table-header-start) 0%, var(--color-table-header-end) 100%)'
            }}>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  style={column.width ? { width: column.width } : undefined}
                  onClick={() => handleSort(column)}
                  className={`${headerCellClass} text-left text-xs font-semibold uppercase tracking-wider text-white ${column.sortable ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
                    } ${column.className || ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.renderHeader ? column.renderHeader(column.label) : column.label}</span>
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
          <tbody className={isCardMode ? 'block' : 'table-row-group'}>
            {data.length === 0 ? (
              <tr className={isCardMode ? 'block' : 'table-row'}>
                <td
                  colSpan={columns.length}
                  className={`${dense ? 'px-3 py-10' : 'px-6 py-12'} ${isCardMode ? 'block' : 'table-cell'} text-center text-maindark/50 dark:text-sidebar/50`}
                >
                  <p>{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              sortedData?.map((row, rowIndex) => (
                <tr
                  key={keyExtractor(row, rowIndex)}
                  onClick={() => onRowClick?.(row, rowIndex)}
                  className={
                    isCardMode
                      ? `mb-3 block rounded-2xl border border-[color:var(--color-border-soft)] last:mb-0 dark:border-primarydark/40 ${hoverable ? 'transition-colors duration-200' : ''
                      } ${onRowClick ? 'cursor-pointer' : ''} bg-primary dark:bg-maindark ${hoverable
                        ? 'hover:bg-[color:var(--color-table-card-hover)] dark:hover:bg-white/[0.05]'
                        : ''
                      }`
                      : `table-row border-b border-[color:var(--color-border-soft)] dark:border-primarydark/30 ${hoverable ? 'transition-colors duration-200' : ''
                      } ${onRowClick ? 'cursor-pointer' : ''} ${striped && rowIndex % 2 !== 0
                        ? 'bg-[color:var(--color-table-row-alt)] dark:bg-white/[0.025]'
                        : 'bg-primary dark:bg-maindark'
                      } ${hoverable
                        ? 'hover:bg-[color:var(--color-table-row-hover)] dark:hover:bg-white/[0.05]'
                        : ''
                      }`
                  }
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={`${bodyCellClass} ${isCardMode ? 'block border-b last:border-b-0' : 'table-cell'} ${!isCardMode ? 'align-middle' : ''} ${column.className || ''}`}
                      aria-label={typeof column.label === "string" ? column.label : undefined}
                    >
                      <div className={isCardMode ? 'flex min-w-0 flex-col items-start gap-2' : 'block min-w-0'}>
                        <span
                          className={`${isCardMode ? 'block' : 'hidden'} text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-table-label)] dark:text-[color:var(--color-table-label-dark)]`}
                        >
                          {column.label}
                        </span>
                        <div className={`min-w-0 break-words text-left ${isCardMode ? 'w-full' : 'w-auto'} ${isCompactMode ? 'text-[13px] leading-5' : ''}`}>
                          {column.render
                            ? column.render(row[column.key], row, rowIndex)
                            : String(row[column.key] ?? '—')}
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}) as <T extends Record<string, any>>(props: TableProps<T>) => ReactElement;
