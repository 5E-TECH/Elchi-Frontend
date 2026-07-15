import { useState, useMemo, useEffect, useRef, memo, type ReactElement } from 'react';
import type { TableProps, ColumnConfig, SortConfig } from './Table.types';
import EmptyState from '../../ui/EmptyState';
import TableSkeleton from '../../ui/TableSkeleton';

export const Table = memo(<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor = (_, index) => index,
  loading = false,
  emptyMessage = "Ma'lumot topilmadi",
  emptyState,
  loadingRows = 6,
  onRowClick,
  mobileRowRender,
  className = '',
  headerCellClassName,
  bodyCellClassName,
  dense = false,
  striped = true,
  bordered = true,
  hoverable = true,
  preserveTableOnDesktop = false,
}: TableProps<T>) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1440,
  );

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const responsiveMode = useMemo(() => {
    if (preserveTableOnDesktop && viewportWidth > 768) {
      if (containerWidth > 0 && containerWidth < 1220) {
        return "compact" as const;
      }
      return "table" as const;
    }

    if (viewportWidth <= 900 || (containerWidth > 0 && containerWidth < 860)) {
      return 'cards' as const;
    }

    if (containerWidth > 0 && containerWidth < 1220) {
      return 'compact' as const;
    }

    return 'table' as const;
  }, [containerWidth, viewportWidth, preserveTableOnDesktop]);

  const isCardMode = responsiveMode === 'cards';
  const isCompactMode = responsiveMode === 'compact';
  const isSmallMobile = viewportWidth <= 560;
  const isTinyMobile = viewportWidth <= 380;
  const mobileColumns = useMemo(
    () =>
      [...columns]
        .filter((column) => !column.hideOnMobile)
        .sort(
          (a, b) =>
            (a.mobileOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.mobileOrder ?? Number.MAX_SAFE_INTEGER),
        ),
    [columns],
  );
  const cardColumns = mobileColumns.length > 0 ? mobileColumns : columns;

  const headerCellClass = headerCellClassName ?? (dense || isCompactMode
    ? 'px-3 py-3 text-[11px]'
    : 'px-6 py-4');
  const bodyCellClass = bodyCellClassName ?? (dense || isCompactMode
    ? 'px-3 py-3 text-[13px]'
    : 'px-6 py-4 text-sm');

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

  const getLabelText = (value: unknown) => {
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    return undefined;
  };

  if (loading) {
    return <TableSkeleton rows={loadingRows} columns={Math.min(columns.length || 5, 7)} />;
  }

  return (
    <div
      ref={wrapperRef}
      className={`min-w-0 overflow-hidden rounded-xl bg-primary shadow-sm sm:rounded-2xl dark:bg-white/[0.025] ${bordered ? 'border border-[color:var(--color-border-strong)] dark:border-white/10' : ''}`}
    >
      <div className={`${isCardMode ? "overflow-visible" : "overflow-x-auto"} custom-scrollbar`}>
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
                  colSpan={isCardMode ? cardColumns.length : columns.length}
                  className={`${dense ? 'px-3 py-8' : 'px-6 py-10'} ${isCardMode ? 'block' : 'table-cell'} text-center text-maindark/50 dark:text-sidebar/50`}
                >
                  {emptyState ?? <EmptyState title={emptyMessage} className="border-0 bg-transparent shadow-none" />}
                </td>
              </tr>
            ) : (
              sortedData?.map((row, rowIndex) => (
                <tr
                  key={keyExtractor(row, rowIndex)}
                  onClick={() => onRowClick?.(row, rowIndex)}
                  className={
                    isCardMode
                      ? mobileRowRender
                        ? `block border-b border-[color:var(--color-border-strong)] px-1.5 dark:border-primarydark/40 sm:px-2 ${hoverable ? 'transition-colors duration-200' : ''
                        } ${onRowClick ? 'cursor-pointer' : ''} bg-primary dark:bg-white/[0.02] ${hoverable
                          ? 'hover:bg-[color:var(--color-table-row-hover)] dark:hover:bg-white/[0.06]'
                          : ''
                        } last:border-b-0`
                        : `block border-b border-[color:var(--color-border-strong)] px-1.5 dark:border-primarydark/40 sm:px-2 ${hoverable ? 'transition-colors duration-200' : ''
                        } ${onRowClick ? 'cursor-pointer' : ''} bg-primary dark:bg-white/[0.02] ${hoverable
                          ? 'hover:bg-[color:var(--color-table-row-hover)] dark:hover:bg-white/[0.06]'
                          : ''
                        } last:border-b-0`
                      : `table-row border-b border-[color:var(--color-border-strong)] dark:border-primarydark/30 ${hoverable ? 'transition-colors duration-200' : ''
                      } ${onRowClick ? 'cursor-pointer' : ''} ${striped && rowIndex % 2 !== 0
                        ? 'bg-[color:var(--color-table-row-alt)] dark:bg-white/[0.045]'
                        : 'bg-primary dark:bg-white/[0.02]'
                      } ${hoverable
                        ? 'hover:bg-[color:var(--color-table-row-hover)] dark:hover:bg-white/[0.065]'
                        : ''
                      }`
                  }
                >
                  {isCardMode && mobileRowRender ? (
                    <td
                      colSpan={columns.length}
                      className={`${dense ? 'px-2 py-2.5' : 'px-2 py-3'} block`}
                    >
                      {mobileRowRender(row, rowIndex)}
                    </td>
                  ) : (
                    (isCardMode ? cardColumns : columns).map((column) => (
                      <td
                        key={String(column.key)}
                        className={`${bodyCellClass} ${isCardMode ? 'block px-2 py-1.5 first:pt-3.5 last:pb-3.5' : 'table-cell'} ${!isCardMode ? 'align-middle' : ''} ${column.className || ''}`}
                        aria-label={getLabelText(column.mobileLabel ?? column.label)}
                      >
                        <div
                          className={
                            isCardMode
                              ? column.mobileFullWidth || isTinyMobile
                                ? "flex min-w-0 flex-col items-start gap-1"
                                : `grid min-w-0 items-start gap-2 ${isSmallMobile ? "grid-cols-[minmax(6rem,7.5rem)_1fr]" : "grid-cols-[minmax(7.5rem,9.5rem)_1fr]"}`
                              : "block min-w-0"
                          }
                        >
                          <span
                            className={`${isCardMode ? 'block' : 'hidden'} text-[10px] font-semibold uppercase tracking-[0.11em] text-[color:var(--color-table-label)] dark:text-[color:var(--color-table-label-dark)]`}
                          >
                            {column.mobileLabel ?? column.label}
                          </span>
                          <div className={`min-w-0 break-words ${isCardMode ? `w-full ${column.mobileFullWidth || isTinyMobile ? "text-left" : "text-right"}` : 'w-auto text-left'} ${isCompactMode ? 'text-[13px] leading-5' : ''}`}>
                            {column.render
                              ? column.render(row[column.key], row, rowIndex)
                              : String(row[column.key] ?? '—')}
                          </div>
                        </div>
                      </td>
                    ))
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}) as <T extends Record<string, any>>(props: TableProps<T>) => ReactElement;
