export interface ColumnConfig<T> {
  key: keyof T;
  label: React.ReactNode;
  width?: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null | undefined;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  renderHeader?: (label: React.ReactNode) => React.ReactNode;
  className?: string;
}

export interface TableProps<T> {
  data: T[];
  columns: ColumnConfig<T>[];
  keyExtractor?: (item: T, index: number) => string | number;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T, index: number) => void;
  className?: string;
  dense?: boolean;
  striped?: boolean;
  bordered?: boolean;
  hoverable?: boolean;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}
