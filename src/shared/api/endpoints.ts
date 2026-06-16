/**
 * Central API registry — every path here must match a real route in the backend
 * `docs/frontend/openapi.json`. Grouped by OpenAPI domain/tag. Role hints in the
 * group comments come from the guide §11 (role → endpoint matrix); the server
 * enforces access, client gating is UX only.
 *
 * Coverage worked from docs/frontend/COVERAGE_REPORT.md:
 *  - 🔴 stale paths repointed to their real backend route (or removed if dead).
 *  - ❌ missing endpoints added below, by domain.
 * `:p` in the report = a dynamic segment (id/token/key).
 */
export const API_ENDPOINTS = {
  // ── Auth (public login/refresh; rest any-auth) ────────────────────────────
  AUTH: {
    LOGIN: "auth/login",
    REFRESH: "auth/refresh",
    LOGOUT: "auth/logout",
    VALIDATE: "auth/validate", // GET — validate current JWT on app load
    MY_PROFILE: "auth/my-profile", // GET (read) / PATCH (update own profile)
    MY_SETTINGS: "auth/my-settings", // PATCH — update own UI settings/preferences
  },

  // ── Identity / Users (superadmin/admin/manager) ──────────────────────────
  USERS: {
    BASE: "users",
    BY_ID: (id: string | number) => `users/${id}`,
    STATUS: (id: string | number) => `users/${id}/status`,
  },
  ADMINS: {
    BASE: "admins", // GET list / POST create
  },
  REGISTRATORS: {
    BASE: "registrators", // GET list / POST create (superadmin)
  },
  MANAGERS: {
    BASE: "managers", // GET list / POST create
  },
  // Operators are not a CRUD user type — no /operators route exists. The role
  // surfaces only via /finance/operators/{id}/* (earnings/payouts). The dead
  // createOperator mutation that posted to /operators was removed.
  MARKETS: {
    BASE: "markets", // GET list / POST create
    ADD_ORDER: (id: string | number) => `markets/${id}/add-order`, // PATCH
    EXPENSE_PROOF: (id: string | number) => `markets/${id}/expense-proof`, // PATCH proof conditions (guide §5)
  },
  COURIERS: {
    BASE: "couriers", // GET list / POST create
    BY_REGION: (regionId: string | number) => `couriers/region/${regionId}`,
  },

  // ── Logistics: Regions / Districts (admin/registrator; superadmin delete) ─
  REGIONS: {
    BASE: "region", // GET all / POST create
    STATS_ALL: "region/stats/all",
    STATS_BY_ID: (regionId: string | number) => `region/stats/${regionId}`,
    BY_ID: (regionId: string | number) => `region/${regionId}`, // GET / PATCH update / DELETE
  },
  DISTRICTS: {
    BASE: "district", // GET all / POST create
    BY_ID: (districtId: string | number) => `district/${districtId}`, // GET / PATCH reassign region / DELETE (superadmin)
    UPDATE_NAME: (districtId: string | number) => `district/name/${districtId}`, // PATCH
    SATO_MATCH_PREVIEW: "district/sato-match/preview", // GET
    SATO_MATCH_APPLY: "district/sato-match/apply", // POST (superadmin)
    SATO_BY_CODE: (satoCode: string | number) => `district/sato/${satoCode}`, // GET
    SATO_UPDATE: (id: string | number) => `district/sato/${id}`, // PATCH
  },

  // ── Orders (role-dependent; see guide §11) ───────────────────────────────
  ORDERS: {
    BASE: "orders", // GET list (filters) / POST create
    BY_ID: (id: string | number) => `orders/${id}`, // GET / PATCH update (full incl. items) / DELETE
    FULL: (id: string | number) => `orders/${id}/full`, // PATCH update by id (full fields)
    TRACKING: (id: string | number) => `orders/${id}/tracking`, // GET history timeline
    SETTLEMENT_STATE: (id: string | number) => `orders/${id}/settlement`, // GET per-order settlement state
    QR_CODE: (token: string | number) => `orders/qr-code/${token}`,
    ASSIGN_COURIER: "orders/assign-to-courier", // POST manager bulk-assign
    SCAN_ASSIGN: "orders/scan-assign", // POST courier scan-assign
    RECEIVE: "orders/receive", // POST market_operator bulk intake
    MARKETS_NEW: "orders/markets/new", // GET markets with NEW orders
    MARKET_NEW: (marketId: string | number) => `orders/markets/${marketId}/new`,
    MARKETS_CANCELLED: "orders/markets/cancelled", // GET markets with cancelled orders
    MARKET_CANCELLED: (marketId: string | number) => `orders/markets/${marketId}/cancelled`,
    MARKET_CANCELLED_HANDOVER: (marketId: string | number) => `orders/markets/${marketId}/cancelled/handover`,
    BY_MARKET: (marketId: string | number) => `orders/market/${marketId}`, // GET orders by market id
    COURIER_ORDERS: "orders/courier/orders",
    SELL: (id: string | number) => `orders/sell/${id}`, // POST courier sell (proof per §5)
    PARTLY_SELL: (id: string | number) => `orders/partly-sell/${id}`, // POST
    ROLLBACK: (id: string | number) => `orders/rollback/${id}`, // POST
    CANCEL: (id: string | number) => `orders/cancel/${id}`, // POST courier cancel (proof per §5)
    COULD_NOT_DELIVER: (id: string | number) => `orders/${id}/could-not-deliver`, // POST courier
    INITIATE_RETURN: (id: string | number) => `orders/${id}/initiate-return`, // POST HQ
    MARK_RETURNED_TO_MARKET: (id: string | number) => `orders/${id}/mark-returned-to-market`, // POST branch
    // External orders (market + integrations)
    EXTERNAL: "orders/external", // GET list / POST create external order
    EXTERNAL_RECEIVE: "orders/external/receive", // POST receive provider payload
    TELEGRAM_BOT_CREATE: "orders/telegram/bot/create", // POST create order via telegram bot
    // COD settlement legs (FIFO per order) — guide §7
    SETTLEMENT_COURIER_TO_BRANCH: "orders/settlement/courier-to-branch", // POST courier
    SETTLEMENT_BRANCH_TO_HQ: "orders/settlement/branch-to-hq", // POST
    SETTLEMENT_HQ_TO_MARKET: "orders/settlement/hq-to-market", // POST manager/HQ
  },

  // ── Posts (registrator/courier/branch) ───────────────────────────────────
  POSTS: {
    BASE: "post", // GET list (pagination)
    NEW: "post/new",
    ON_THE_ROAD: "post/on-the-road",
    REJECTED: "post/rejected",
    COURIER_OLD: "post/courier/old-posts",
    COURIER_REJECTED: "post/courier/rejected",
    RETURN_REQUESTS_LIST: "post/return-requests/list",
    RETURN_REQUESTS_APPROVE: "post/return-requests/approve", // POST
    RETURN_REQUESTS_REJECT: "post/return-requests/reject", // POST
    CANCEL: "post/cancel", // POST courier create canceled post
    CANCEL_RECEIVE: (postId: string | number) => `post/cancel/receive/${postId}`, // POST receive canceled post (admin)
    CHECK: (id: string | number) => `post/check/${id}`, // POST check post order by qr token
    CHECK_CANCEL: (id: string | number) => `post/check/cancel/${id}`, // POST check canceled post order by qr token
    COURIERS_BY_POST: (id: string | number) => `post/courier/${id}`, // POST get couriers by post id
    SCAN: (id: string | number) => `post/scan/${id}`, // GET post by scanner (was POSTS.QR_CODE)
    REASSIGN: (id: string | number) => `post/reassign/${id}`, // PATCH reassign sent post to another courier
    RECEIVE_ORDER: (id: string | number) => `post/receive/order/${id}`, // PATCH receive order (courier)
    RECEIVE_SCAN: (id: string | number) => `post/receive/scan/${id}`, // PATCH receive post with scanner (courier)
    ORDERS_BY_POST_ID: (postId: string | number) => `post/orders/${postId}`,
    REJECTED_ORDERS_BY_POST_ID: (postId: string | number) => `post/orders/rejected/${postId}`,
    BY_ID: (postId: string | number) => `post/${postId}`, // GET / PATCH send post (superadmin) / DELETE (superadmin)
    RECEIVE: (postId: string | number) => `post/receive/${postId}`, // PATCH receive post (branch/courier)
  },

  // ── Transfer batches (branch staff) — guide §8 ───────────────────────────
  BATCHES: {
    BASE: "transfer-batches", // GET list
    BY_ID: (id: string | number) => `transfer-batches/${id}`,
    REMAINING: (id: string | number) => `transfer-batches/${id}/remaining`,
    SEND: (id: string | number) => `transfer-batches/${id}/send`, // PATCH mark sent (vehicle info)
    RECEIVE: (id: string | number) => `transfer-batches/${id}/receive`,
    RECEIVE_ORDERS: (id: string | number) => `transfer-batches/${id}/receive-orders`,
    CANCEL: (id: string | number) => `transfer-batches/${id}/cancel`, // POST cancel + unassign orders
  },

  // ── Finance (admin/manager/branch/courier — see guide §11) ───────────────
  CASHBOX: {
    PAYMENT_COURIER: "finance/cashbox/payment/courier",
    PAYMENT_BRANCH_TO_MAIN: "finance/cashbox/payment/branch-to-main",
    PAYMENT_MARKET: "finance/cashbox/payment/market",
    MY_CASHBOX: "finance/cashbox/my-cashbox",
    MAIN: "finance/cashbox/main", // was stale "cashbox/main"
    SPEND: "finance/cashbox/spend",
    FILL: "finance/cashbox/fill",
    // Shifts (smena) — repointed from stale "cashbox/shift/*" to "finance/shift/*".
    // Backend has no "current shift" route; GET /finance/shift (filters) is used.
    SHIFT_CURRENT: "finance/shift",
    SHIFT_HISTORY: "finance/shift",
    SHIFT_OPEN: "finance/shift/open",
    SHIFT_CLOSE: "finance/shift/close",
  },
  FINANCE: {
    CASHBOX_BASE: "finance/cashbox", // POST create cashbox
    CASHBOX_ALL_INFO: "finance/cashbox/all-info",
    CASHBOX_MAIN: "finance/cashbox/main",
    CASHBOX_BALANCE: "finance/cashbox/balance", // PATCH update balance + history
    CASHBOX_FINANCIAL_BALANCE: "finance/cashbox/financial-balanse", // backend spelling
    CASHBOX_BY_USER: (id: string | number) => `finance/cashbox/user/${id}`, // find cashbox(es) by user
    CASHBOX_USER_MAIN: (id: string | number) => `finance/cashbox/user/${id}/main`, // by user with date filters
    MANAGER_PAYABLE_TO_HQ: "finance/cashbox/manager/payable-to-hq",
    MANAGER_SETTLEMENT: "finance/cashbox/manager/settlement",
    HISTORY: "finance/history",
    HISTORY_BY_ID: (id: string | number) => `finance/history/${id}`,
    HEALTH: "finance/health",
    // Financial ledger
    FINANCIAL_BALANCE_ENTRIES: "finance/financial-balance/entries", // POST manual ledger entry
    FINANCIAL_BALANCE_HISTORY: "finance/financial-balance/history", // GET ledger + current balance
    // Salary
    SALARY: "finance/salary", // POST create / PATCH update
    SALARY_BY_USER: (userId: string | number) => `finance/salary/${userId}`,
    // Shifts
    SHIFT: "finance/shift",
    SHIFT_OPEN: "finance/shift/open",
    SHIFT_CLOSE: "finance/shift/close",
    // Operators (commission) — read by admins; operator reads own
    OPERATOR_PAYMENTS: "finance/operator-payments", // POST payout to operator
    OPERATOR_BALANCE: (operatorId: string | number) => `finance/operators/${operatorId}/balance`,
    OPERATOR_EARNINGS: (operatorId: string | number) => `finance/operators/${operatorId}/earnings`,
    OPERATOR_PAYOUTS: (operatorId: string | number) => `finance/operators/${operatorId}/payments`,
    // NOTE: operation-type / source-type / cashbox-type are NOT backend routes.
    // Per guide §5 these enums live client-side — add local constant modules when a
    // screen needs them. The dead fetch-hooks that pointed here were removed.
  },
  CASHBOX_HISTORY: {
    BY_ID: (id: string | number) => `finance/history/${id}`, // was stale "cashbox-history/:id"
  },

  // ── Analytics (admin; role-aware dashboard) ──────────────────────────────
  ANALYTICS: {
    DASHBOARD: "analytics/dashboard",
    REVENUE: "analytics/revenue",
    KPI: "analytics/kpi",
    REPORT_COURIERS: "analytics/reports/couriers",
    REPORT_FINANCE: "analytics/reports/finance",
    REPORT_ORDERS: "analytics/reports/orders",
  },

  // ── Products / Catalog (market owns; admin/registrator manage) ───────────
  PRODUCTS: {
    BASE: "product", // GET list / POST create
    HEALTH: "product/health",
    MY_PRODUCTS: "product/my-products",
    BY_ID: (id: string | number) => `product/${id}`, // GET / PATCH (admin/registrator) / DELETE
    BY_MARKET_ID: (id: string | number) => `product/market/${id}`,
    UPDATE_MY: (id: string | number) => `product/my/${id}`, // PATCH own product (market)
  },

  // ── Integrations (admin/registrator) ─────────────────────────────────────
  INTEGRATIONS: {
    BASE: "integrations", // GET list / POST create
    BY_ID: (id: string | number) => `integrations/${id}`, // GET / PATCH / DELETE
    RECEIVABLES: "integrations/receivables",
    RECEIVABLE_BALANCE: (id: string | number) => `integrations/${id}/receivable-balance`,
    REMITTANCES: (id: string | number) => `integrations/${id}/remittances`, // POST
    HEALTHCHECK: (id: string | number) => `integrations/${id}/healthcheck`, // POST
    TEST: (id: string | number) => `integrations/${id}/test`, // POST
    RETRY: (id: string | number) => `integrations/${id}/retry`, // POST
    SYNC: (id: string | number) => `integrations/${id}/sync`, // POST
    SYNC_QUEUE: (id: string | number) => `integrations/${id}/sync/queue`, // POST
    SYNC_HISTORY_BY_ID: (id: string | number) => `integrations/${id}/sync-history`,
    SYNC_HISTORY: "integrations/sync/history",
    SHIPMENT_BY_ORDER: (orderId: string | number) => `integrations/shipments/${orderId}`,
    DISPATCH: (slug: string | number) => `integrations/${slug}/dispatch`, // POST
    REQUEST: (slug: string | number) => `integrations/${slug}/request`, // POST universal request
    SEARCH_BY_QR: (slug: string | number) => `integrations/${slug}/search-by-qr`, // POST
  },

  // ── Investors (admin-managed; investor reads own) ────────────────────────
  INVESTORS: {
    BASE: "investors", // GET list / POST create
    BY_ID: (id: string | number) => `investors/${id}`, // GET / PATCH / DELETE
    INVESTMENTS: (investorId: string | number) => `investors/${investorId}/investments`,
    PROFITS: (investorId: string | number) => `investors/${investorId}/profits`,
  },
  INVESTMENTS: {
    BASE: "investments", // GET list / POST create
    BY_ID: (id: string | number) => `investments/${id}`, // GET / PATCH / DELETE
  },
  PROFITS: {
    BASE: "profits", // GET list / POST create
    CALCULATE: "profits/calculate", // POST by period + percentage
    MARK_PAID: (id: string | number) => `profits/${id}/mark-paid`, // PATCH
  },

  // ── Notifications (Telegram) ─────────────────────────────────────────────
  NOTIFICATIONS: {
    BASE: "notifications", // GET configs / POST create config
    BY_ID: (id: string | number) => `notifications/${id}`, // GET / PATCH / DELETE
    HEALTH: "notifications/health",
    SEND: "notifications/send", // POST send to telegram group(s)
    CONNECT_BY_TOKEN: "notifications/connect-by-token", // POST connect group by token
  },

  // ── Branches (admin full; manager/branch scoped) — guide §8 ──────────────
  BRANCHES: {
    BASE: "branches", // GET list / POST create
    NEW_ORDERS: "branches/new-orders", // branches with NEW orders
    TREE: "branches/tree", // full nested tree
    WITH_SENT_BATCHES: "branches/with-sent-batches",
    TRANSFER_BATCHES: "branches/transfer-batches", // POST create batches from requester branch
    POST_DISPATCH: (postId: string | number) => `branches/posts/${postId}/dispatch`,
    BY_ID: (id: string | number) => `branches/${id}`, // GET / PATCH / DELETE
    DESCENDANTS: (id: string | number) => `branches/${id}/descendants`,
    ANALYTICS_MARKETS: (id: string | number) => `branches/${id}/analytics/markets`,
    RETURN_BATCHES: (id: string | number) => `branches/${id}/return-batches`,
    USERS: (id: string | number) => `branches/${id}/users`, // GET assigned / POST assign
    USER_BY_ID: (branchId: string | number, userId: string | number) =>
      `branches/${branchId}/users/${userId}`, // DELETE remove user from branch
    // Branch config (was stale "branches/:id/settings")
    SETTINGS: (id: string | number) => `branches/${id}/config`, // GET list / POST set
    SETTING_BY_ID: (branchId: string | number, key: string | number) =>
      `branches/${branchId}/config/${key}`, // GET / PATCH / DELETE by key
  },

  // ── Scan / QR (any-auth) ─────────────────────────────────────────────────
  SCAN: {
    BY_TOKEN: (token: string | number) => `scan/${token}`, // resolve QR → order/batch/post
  },

  // ── Files (MinIO) — guide §10 ────────────────────────────────────────────
  FILES: {
    UPLOAD: "files/upload", // POST multipart/form-data
    PDF: "files/pdf", // POST generate PDF
    QR: "files/qr", // POST generate QR
    BY_KEY: (key: string) => `files/${key}`, // GET signed URL / DELETE
  },

  // ── Excel export (binary .xlsx — don't JSON-parse) — guide §10 ───────────
  EXPORT: {
    ORDERS_XLSX: "export/orders.xlsx",
    CASHBOX_HISTORY_XLSX: "export/cashbox-history.xlsx",
    SHIFTS_XLSX: "export/shifts.xlsx",
  },

  // ── Printer (binary/print) — guide §10 ───────────────────────────────────
  PRINTER: {
    RECEIPT: "printer/receipt", // POST A4 receipt (12/sheet)
    THERMAL_PDF: "printer/thermal-pdf", // POST thermal label PDF 100×60mm
  },

  // ── Search (any-auth) ────────────────────────────────────────────────────
  SEARCH: {
    BASE: "search", // GET global search
    HEALTH: "search/health",
  },

  // ── Health (public/ops) ──────────────────────────────────────────────────
  HEALTH: {
    ROOT: "", // GET / — gateway health via identity service
    LIVENESS: "health",
    READINESS: "health/readiness",
  },

  // ── Webhooks (public — provider inbound, no JWT) ─────────────────────────
  WEBHOOKS: {
    BY_SLUG: (slug: string | number) => `webhooks/${slug}`, // POST
  },
} as const;
