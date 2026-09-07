// Mirrors the backend notification-service `toPublic()` shape for a single
// per-recipient in-app inbox row (see Elchi-Backend notification-inbox.service).

export const NOTIFICATION_CATEGORIES = [
  "order",
  "finance",
  "branch",
  "logistics",
  "account",
  "system",
  "marketing",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_PRIORITIES = ["low", "normal", "high", "critical"] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export interface InboxNotification {
  id: string;
  /** Fine-grained event key, convention `{domain}.{event}` e.g. `order.sold`. */
  type: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string | null;
  /** Arbitrary structured payload (ids, amounts, …) the frontend can act on. */
  data: Record<string, unknown> | null;
  /** Deep-link the frontend navigates to on click (e.g. `/orders/123`). */
  link: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface InboxListParams {
  page?: number;
  limit?: number;
  is_read?: boolean;
  type?: string;
  category?: NotificationCategory;
  priority?: NotificationPriority;
}

export interface InboxListResult {
  items: InboxNotification[];
  /** Total unread across the whole inbox (not just this page). */
  unread: number;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
