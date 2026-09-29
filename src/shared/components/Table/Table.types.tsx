export interface ColumnConfig<T> {
  key: keyof T;
  label: React.ReactNode;
  mobileLabel?: React.ReactNode;
  width?: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null | undefined;
  // Column arrays combine different field types; the row remains strongly
  // typed while custom renderers intentionally receive the selected value.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  /**
   * So'rov yiqilgan (tarmoq/500/403) — bo'sh holat EMAS, xato holati chiqadi.
   * Ilgari xato "ma'lumot topilmadi" bo'lib ko'rinardi va operator "bugun
   * buyurtma yo'q" deb o'ylardi (sfNW22M7).
   */
  error?: boolean;
  onRetry?: () => void;
  onRowClick?: (row: T, index: number) => void;
  /**
   * Bosiladigan qatorning skrinriderdagi nomi (masalan "Buyurtma №123, Ali").
   * Berilmasa qator matni o'qiladi.
   */
  getRowAriaLabel?: (row: T, index: number) => string;
  mobileRowRender?: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerCellClassName?: string;
  bodyCellClassName?: string;
  dense?: boolean;
  striped?: boolean;
  bordered?: boolean;
  hoverable?: boolean;
  preserveTableOnDesktop?: boolean;
  /** Berilsa, sort holati tashqaridan boshqariladi (masalan URL query bilan). */
  sortConfig?: SortConfig | null;
  onSortChange?: (config: SortConfig | null) => void;
  /**
   * `true` bo'lsa qatorlar qayta tartiblanmaydi — ma'lumot allaqachon serverda
   * saralangan (sarlavha/chip faqat `onSortChange` ni chaqiradi).
   */
  manualSort?: boolean;
  sortLabel?: string;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}
