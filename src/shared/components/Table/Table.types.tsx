export interface ColumnConfig<T> {
  key: keyof T;
  label: React.ReactNode;
  mobileLabel?: React.ReactNode;
  width?: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null | undefined;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  renderHeader?: (label: React.ReactNode) => React.ReactNode;
  className?: string;
  hideOnMobile?: boolean;
  mobileOrder?: number;
  mobileFullWidth?: boolean;
}

export interface TableProps<T> {
  data: T[];
  columns: ColumnConfig<T>[];
  keyExtractor?: (item: T, index: number) => string | number;
  loading?: boolean;
  emptyMessage?: string;
  emptyState?: React.ReactNode;
  loadingRows?: number;
  onRowClick?: (row: T, index: number) => void;
  mobileRowRender?: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerCellClassName?: string;
  bodyCellClassName?: string;
  dense?: boolean;
  striped?: boolean;
  bordered?: boolean;
  hoverable?: boolean;
  preserveTableOnDesktop?: boolean;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}
