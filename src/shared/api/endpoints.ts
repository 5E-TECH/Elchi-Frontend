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
    TELEGRAM: "auth/telegram", // POST { init_data } — Mini App login, 30-min JWT, no refresh (MWYaqprw)
    // GET (istalgan rol) → { active_count, sessions: [{ id, device_name, device_id, user_agent, ip, logged_in_at,
    // last_seen_at, expires_at, current }] } — FAQAT o'z faol sessiyalari, last_seen_at bo'yicha yangisi tepada,
    // ko'pi bilan 50 ta (Elchi Pochta #3); + can_revoke_others, revoke_available_at (ISO | null) — shu qurilmadan
    // birinchi kirganiga 48 soat to'lmagan sessiya boshqalarni yopa olmaydi (eski backend bermaydi — ruxsat)
    SESSIONS: "auth/sessions",
    // DELETE → { revoked: 1, session_ids: [id] } — o'z boshqa sessiyasini yopish; 400 — joriy sessiya yoki noto'g'ri
    // ID, 404 — topilmadi yoki allaqachon yopilgan, 403 `code: SESSION_TOO_NEW` (+ available_at) — joriy sessiya
    // yangi (48 soat). Yopilgan qurilma keyingi so'rovida 401 oladi (refresh ham rad).
    SESSION_BY_ID: (id: string) => `auth/sessions/${encodeURIComponent(id)}`,
    // POST (tanasiz) → { revoked: n, session_ids } — joriydan boshqa barcha faol sessiyalar (n = 0 bo'lishi mumkin);
    // 400 — joriy sessiya aniqlanmadi (sessiyadan oldingi eski token) → qayta kirish kerak; 403 SESSION_TOO_NEW.
    SESSIONS_REVOKE_OTHERS: "auth/sessions/revoke-others",
  },

  // ── Identity / Users (superadmin/admin/manager) ──────────────────────────
  USERS: {
    BASE: "users",
    BY_ID: (id: string | number) => `users/${id}`,
    STATUS: (id: string | number) => `users/${id}/status`,
    // O'z Telegram'ini botga ulash (har qanday xodim; mijoz/investor — 403).
    MY_TELEGRAM_LINK_CODE: "users/me/telegram/link-code", // POST → { token, purpose, expires_at, deep_link, command } (bir martalik, 10 daqiqa)
    MY_TELEGRAM: "users/me/telegram", // DELETE → { unlinked }
    // Rolni o'zgartirish (FY-2, K3scaE0W; faqat SUPERADMIN): PATCH { role } — faqat admin ⇄ registrator ⇄ manager ⇄
    // logist. 409 — filialga biriktirilgan, 503 — biriktiruv tekshirilmadi yoki logist viloyatlari bo'shatilmadi.
    ROLE: (id: string | number) => `users/${id}/role`,
  },
  // Rol katalogi (FY-2, K3scaE0W; superadmin, admin, menejer): GET → { items, changeable_roles }. Yorliqlar faqat
  // o'zbekcha — frontend faqat `changeable_roles` ni oladi, nomlar i18n'dan.
  ROLES: {
    BASE: "roles",
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
    CANCELLED_HANDOVER_QR: (id: string | number) => `markets/${id}/cancelled-handover-qr`, // PATCH
    EXPENSE_PROOF: (id: string | number) => `markets/${id}/expense-proof`, // PATCH proof conditions (guide §5)
    // PATCH { tg_group_show_customer_pii } — Telegram guruhi kartasida mijoz ismi/telefoni (ysBqD9Nx;
    // superadmin, admin, market — faqat o'zinikini)
    TELEGRAM_GROUP_PII: (id: string | number) => `markets/${id}/telegram-group-pii`,
  },
  // Market o'z operatorlari (i76gGjyq; faqat MARKET, faqat o'z operatorlari — JWT `sub`, market_id yuborilmaydi)
  MARKET_OPERATORS: {
    BASE: "market-operators", // GET ?search&status&page&limit → { items, meta } / POST { name, phone_number, password }
    BY_ID: (id: string | number) => `market-operators/${id}`, // DELETE (soft)
    // PATCH { commission_type: percent | fixed | null, commission_value } — PERCENT 0..100, FIXED 0..1 000 000, 2 kasr
    COMMISSION: (id: string | number) => `market-operators/${id}/commission`,
    // XtcEyQjb: PATCH { can_view_warehouse_stock: boolean } — «Ombordagi qoldiqni ko'radi» (begona operator — 404)
    WAREHOUSE_ACCESS: (id: string | number) => `market-operators/${id}/warehouse-access`,
  },
  // Logistlar (superadmin/admin; LG-2, dzyVftBx): GET ?search&status&page&limit (limit ≤ 100) → { items, meta } /
  // POST { name, phone_number, password, salary, payment_day? } — filialsiz, viloyatlar alohida (REGIONS.LOGIST_BULK).
  LOGISTS: {
    BASE: "logists",
  },
  COURIERS: {
    BASE: "couriers", // GET list / POST create
    BY_REGION: (regionId: string | number) => `couriers/region/${regionId}`,
    // Kuryerni boshqa filialga o'tkazish (superadmin/admin): avval tekshiruv
    // (pul, qo'ldagi buyurtma, qaytarilmagan pochta), keyin o'tkazish.
    TRANSFER_CHECK: (id: string | number) => `couriers/${id}/transfer-check`, // GET
    BRANCH: (id: string | number) => `couriers/${id}/branch`, // PATCH { branch_id }
  },

  // ── Logistics: Regions / Districts (admin/registrator; superadmin delete) ─
  REGIONS: {
    BASE: "region", // GET all / POST create
    STATS_ALL: "region/stats/all",
    STATS_BY_ID: (regionId: string | number) => `region/stats/${regionId}`,
    MY_DISTRICT_STATS: "region/my/district-stats", // GET — kuryer/menejerning o'z viloyati (tumanlar kesimida)
    BY_ID: (regionId: string | number) => `region/${regionId}`, // GET / PATCH update / DELETE
    // Logist biriktirish (superadmin/admin; LG-2, dzyVftBx). POST { logist_id, region_ids } — region_ids dagilar
    // logistga o'tadi, uning qolgan viloyatlaridan u olinadi (bitta tranzaksiya).
    LOGIST_BULK: "region/logist/bulk",
    LOGIST: (regionId: string | number) => `region/${regionId}/logist`, // PATCH { logist_id | null } — bitta viloyat
  },
  DISTRICTS: {
    BASE: "district", // GET all / POST create
    BY_ID: (districtId: string | number) => `district/${districtId}`, // GET / PATCH reassign region / DELETE (admin/superadmin)
    UPDATE_NAME: (districtId: string | number) => `district/name/${districtId}`, // PATCH
    SATO_MATCH_PREVIEW: "district/sato-match/preview", // GET
    SATO_MATCH_APPLY: "district/sato-match/apply", // POST (superadmin)
    SATO_BY_CODE: (satoCode: string | number) => `district/sato/${satoCode}`, // GET
    SATO_UPDATE: (id: string | number) => `district/sato/${id}`, // PATCH
    // POST {target_district_id} — tuman boshqasiga qo'shiladi va o'chadi (admin/superadmin; DM-1)
    MERGE: (districtId: string | number) => `district/${districtId}/merge`,
    // GET — tumanga bog'langan tirik {orders, users, branches} (admin/superadmin; Is1zvHN7, DM-2)
    USAGE: (districtId: string | number) => `district/${districtId}/usage`,
  },

  // ── Customers — buyurtma yaratishda mijoz taklifi (hiqRNhkI, CS-A) ─────────
  CUSTOMERS: {
    // GET ?phone=<kamida 7 raqam>&market_id= — ko'pi bilan 10 ta. Market rolida `market_id` yuborilmaydi
    // (token); registrator/menejer uchun majburiy; admin uchun — xulosa (`orders_count`) uchun.
    SUGGEST: "customers/suggest",
  },

  // ── Orders (role-dependent; see guide §11) ───────────────────────────────
  ORDERS: {
    BASE: "orders", // GET list (filters) / POST create
    EXPORT_EXCEL: "orders/export/excel", // GET .xlsx — `GET /orders` filtrlari bilan, bitta so'rov (xWsCAA5N)
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
    MARKET_CANCELLED_QR: (marketId: string | number) => `orders/markets/${marketId}/cancelled/qr`,
    MARKET_CANCELLED_HANDOVER: (marketId: string | number) =>
      `orders/markets/${marketId}/cancelled/handover`,
    BY_MARKET: (marketId: string | number) => `orders/market/${marketId}`, // GET orders by market id
    COURIER_ORDERS: "orders/courier/orders",
    COURIER_ORDER_COUNTS: "orders/courier/orders/counts", // GET kuryer tablari soni { waiting, all, cancelled } (0d11ewk7)
    STATUS_COUNTS: "orders/status-counts", // GET holat tablari sonlari + new_incoming — `GET /orders` filtrlari bilan (GaBIPi3Z)
    SELL: (id: string | number) => `orders/sell/${id}`, // POST courier sell (proof per §5)
    PARTLY_SELL: (id: string | number) => `orders/partly-sell/${id}`, // POST
    ROLLBACK: (id: string | number) => `orders/rollback/${id}`, // POST
    CANCEL: (id: string | number) => `orders/cancel/${id}`, // POST courier cancel (proof per §5)
    EXTRA_COST_APPROVALS: "orders/extra-cost-approvals", // GET pending market approvals
    EXTRA_COST_APPROVAL_APPROVE: (id: string | number) =>
      `orders/extra-cost-approvals/${id}/approve`,
    EXTRA_COST_APPROVAL_REJECT: (id: string | number) => `orders/extra-cost-approvals/${id}/reject`,
    COULD_NOT_DELIVER: (id: string | number) => `orders/${id}/could-not-deliver`, // POST courier
    INITIATE_RETURN: (id: string | number) => `orders/${id}/initiate-return`, // POST HQ
    MARK_RETURNED_TO_MARKET: (id: string | number) => `orders/${id}/mark-returned-to-market`, // POST branch
    // External orders (market + integrations)
    EXTERNAL: "orders/external", // GET list / POST create external order
    EXTERNAL_RECEIVE: "orders/external/receive", // POST receive provider payload
    // Kiruvchi posilkalarning manbalari — qabul kutayotgan tashqi buyurtmalar
    // manba bo'yicha guruhlangan (soni, summasi, eng eski sanasi).
    EXTERNAL_SOURCES: "orders/external/sources", // GET grouped incoming sources
    // Skanerlangan yorliq tokenlari bilan qabul qilish. `order_ids` EMAS:
    // server skanerlash dalilini O'ZI tekshirishi kerak.
    EXTERNAL_RECEIVE_BY_SCAN: "orders/external/receive-by-scan", // POST
    TELEGRAM_BOT_CREATE: "orders/telegram/bot/create", // POST create order via telegram bot
    // AI bilan buyurtma: matn/rasmdan preview (hech narsa yaratmaydi) va
    // operator tasdiqlagan buyurtmalarni yaratish (har biriga alohida natija).
    AI_PARSE: "orders/ai-parse", // POST multipart: text, market_id, images[]
    AI_CONFIRM: "orders/ai-confirm", // POST { market_id?, orders[] }
    AI_AVAILABILITY: "orders/ai-availability", // GET { enabled, state } — AI tabini ko'rsatish/yashirish
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
    // Buyurtmani SHU pochtadan o'chirish (soft-delete), faqat superadmin va NEW pochta (yokjwjXG). 409 — sabab matnda.
    DELETE_ORDERS: "post/delete", // POST { post_id, order_ids, reason }
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
    HISTORY: (id: string | number) => `transfer-batches/${id}/history`, // GET tarix, eng eskisi birinchi (3HKvAyhm)
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
    // Elchi Pochta №1 — kassa xarajati kategoriyalari: GET (superadmin, admin, menejer; `include_deleted` — faqat
    // superadmin), POST / PATCH :id / DELETE :id (faqat superadmin, o'chirish — yumshoq). `spend` ixtiyoriy
    // `expense_category_id` oladi, `fill` uni rad etadi (400).
    EXPENSE_CATEGORIES: "finance/cashbox/expense-categories",
    EXPENSE_CATEGORY: (id: string | number) => `finance/cashbox/expense-categories/${id}`,
    // Smena (kfdfYDik): joriy holat — `GET finance/shift/current` (`data.shift` — ochiq smena yoki null,
    // `data.required`); kassa doirasi JWT'dan (SA/admin — MAIN, menejer — o'z filiali). Ro'yxat — `finance/shift`.
    SHIFT_CURRENT: "finance/shift/current",
    SHIFT_HISTORY: "finance/shift",
    SHIFT_OPEN: "finance/shift/open",
    SHIFT_CLOSE: "finance/shift/close",
    // kiZgTybn — smena yopishda har karta qoldig'ini tasdiqlash: sozlamalar (GET — yopuvchi rollar, PATCH — faqat
    // superadmin), qoldiq skrinshoti (multipart `photo`), smena hisoboti (naqd + kartalar + AI holati).
    SHIFT_SETTINGS: "finance/shift/settings",
    SHIFT_ACCOUNT_PHOTO: "finance/shift/account-photo",
    SHIFT_REPORT: (id: string | number) => `finance/shift/${id}/report`,
    // Zv3MLn0a — kassa kartalari (jonli qoldiq har karta bo'yicha; superadmin/admin — asosiy, menejer — o'z filiali).
    CARDS: "finance/cashbox/cards",
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
    // HQ kuryerlari (superadmin/admin "Qabul qilinishi kerak" ro'yxati uchun)
    HQ_COURIERS: "finance/cashbox/hq-couriers",
    HISTORY: "finance/history",
    HISTORY_BY_ID: (id: string | number) => `finance/history/${id}`,
    HEALTH: "finance/health",
    // Financial ledger
    FINANCIAL_BALANCE_ENTRIES: "finance/financial-balance/entries", // POST manual ledger entry
    FINANCIAL_BALANCE_HISTORY: "finance/financial-balance/history", // GET ledger + current balance
    FINANCIAL_BALANCE_ANALYTICS: "finance/financial-balance/analytics",
    FINANCIAL_BALANCE_TOP_IMPACTS: "finance/financial-balance/top-impacts",
    // Salary
    SALARY: "finance/salary", // POST create / PATCH update
    SALARY_BY_USER: (userId: string | number) => `finance/salary/${userId}`,
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

  // ── AI xarajat paneli (Celz3rKJ; faqat SUPERADMIN / ADMIN) — «Balans → AI xarajat» ──
  AI_USAGE: {
    DASHBOARD: "ai-usage/dashboard", // GET ?fromDate&toDate (YYYY-MM-DD, Toshkent; sukut — oxirgi 30 kun)
    AI_ORDERS: "ai-usage/ai-orders", // GET ?fromDate&toDate&limit (1..100)
  },

  // ── Products / Catalog (xodim boshqaradi; market va operator — faqat o'qiydi, MH-1) ──
  PRODUCTS: {
    BASE: "product", // GET list / POST create
    HEALTH: "product/health",
    MY_PRODUCTS: "product/my-products", // GET (market / market_operator — faqat o'qish)
    BY_ID: (id: string | number) => `product/${id}`, // GET / PATCH (admin/registrator) / DELETE
    BY_MARKET_ID: (id: string | number) => `product/market/${id}`,
  },

  // ── Yetkazish narxi (logistics, DAqXPeSy) — hisoblash xodim + market; tarif va qoidalar — superadmin, admin ──
  DELIVERY_PRICING: {
    // POST { items: [{ weight_kg, length_cm, width_cm, height_cm, volumetric_enabled } | { product_id }], express? }
    // → data.quotes { city, center, address } (faol tarifi yo'q — null); hududsiz (mahsulot formasi, 6FLyjO6j)
    QUOTE_BY_TARIFF: "delivery/quote/by-tariff",
    // GET → data.current { city, center, address } + data.versions (is_current, is_scheduled) · POST yangi versiya
    // { tariff_id, base_price, extra_per_kg, days_min, days_max, valid_from? } — SUPERADMIN, ADMIN (47WFHzlx)
    TARIFFS: "delivery/tariffs",
    SETTINGS: "delivery/pricing-settings", // GET faol versiya · PATCH qisman (yangi versiya) — SUPERADMIN, ADMIN
    // GET → data.versions (yangisi tepada, is_active, created_by_name) — SUPERADMIN, ADMIN (47WFHzlx)
    SETTINGS_HISTORY: "delivery/pricing-settings/history",
  },

  // ── Integrations (admin/registrator) ─────────────────────────────────────
  INTEGRATIONS: {
    BASE: "integrations", // GET list / POST create
    BY_ID: (id: string | number) => `integrations/${id}`, // GET / PATCH / DELETE
    // Jo'natmalar — chiquvchi ulanishning posilkalari (status, xato, urinish).
    SHIPMENTS_BY_ID: (id: string | number) => `integrations/${id}/shipments`,
    /**
     * KIRUVCHI webhook jurnali — ular bizga yuborgan hodisalar.
     *
     * ⚠️ `SYNC_HISTORY` bilan ARALASHTIRMANG: u CHIQUVCHI yo'l (biz
     * tortib olgan/yuborgan sinxronlar). Bu esa teskari yo'nalish:
     * imzo to'g'rimi, natija nima, xato sababi nima.
     *
     * Tana (`raw_body`) QAYTARILMAYDI — ichida mijoz telefoni va manzili
     * bo'ladi, ro'yxatda esa savol "nima bo'ldi".
     */
    WEBHOOK_LOGS: "integrations/webhook-logs",
    STATUS_CATALOG: "integrations/status-catalog", // GET kanonik posilka/to'lov statuslari (status xaritasi)
    /**
     * ONLAYN TO'LOV tranzaksiyalari.
     *
     * `unapplied_only=true` — buyurtmaga qo'llanmagan to'lovlar.
     * Operatorning birinchi savoli aynan shu: qaysi pul kelib, hech
     * qayerga yozilmadi?
     */
    PAYMENTS: "integrations/payments",
    RECEIVABLES: "integrations/receivables",
    RECEIVABLE_BALANCE: (id: string | number) => `integrations/${id}/receivable-balance`,
    REMITTANCES: (id: string | number) => `integrations/${id}/remittances`, // POST yozish · GET ro'yxat (IS-3)
    // IS-3 (DxdZFdIk): to'lovni bekor qilish — `{ reason, reverse_cashbox? }` (409 — avans ishlatilgan / eski yozuv).
    REMITTANCE_CANCEL: (id: string | number, remittanceId: string | number) =>
      `integrations/${id}/remittances/${remittanceId}/cancel`, // POST
    HEALTHCHECK: (id: string | number) => `integrations/${id}/healthcheck`, // POST
    TEST: (id: string | number) => `integrations/${id}/test`, // POST
    RETRY: (id: string | number) => `integrations/${id}/retry`, // POST
    SYNC: (id: string | number) => `integrations/${id}/sync`, // POST
    SYNC_QUEUE: (id: string | number) => `integrations/${id}/sync/queue`, // POST
    // Status solishtiruvini hoziroq yurgizish (fG48Xv5X): 409 — master o'chiq yoki boshqasi ishlayapti, 400 — status_query yo'q.
    RECONCILE_NOW: (id: string | number) => `integrations/${id}/reconcile-now`, // POST
    SYNC_HISTORY_BY_ID: (id: string | number) => `integrations/${id}/sync-history`,
    SYNC_HISTORY: "integrations/sync/history",
    /**
     * Panel metrikasi — hodisa, yetmagan, navbat, javob vaqti.
     * ⚠️ Backendda `:id` marshrutlaridan OLDIN e'lon qilingan, aks holda
     * "metrics" integratsiya id'si deb o'qilardi.
     */
    METRICS: "integrations/metrics",
    SHIPMENT_BY_ORDER: (orderId: string | number) => `integrations/shipments/${orderId}`,
    DISPATCH: (slug: string | number) => `integrations/${slug}/dispatch`, // POST
    REQUEST: (slug: string | number) => `integrations/${slug}/request`, // POST universal request
    SEARCH_BY_QR: (slug: string | number) => `integrations/${slug}/search-by-qr`, // POST
  },

  // ── Investors (admin-managed; investor reads own) ────────────────────────
  INVESTORS: {
    BASE: "investors", // GET list / POST create
    /**
     * IN-1 (vpKijXce): investorning O'ZI — doira faqat JWT'dan (`@Roles(INVESTOR)`), `investor_id` yuborilmaydi.
     * ⚠️ Backendda `investors/:id` dan OLDIN e'lon qilingan (aks holda "me" id deb o'qilardi) — shu tartibda.
     * Xatolar: 403 — profil nofaol, 404 — login investor yozuviga bog'lanmagan, 409 — bir nechta yozuv.
     */
    ME: "investors/me", // GET — profil + yig'indi
    ME_DASHBOARD: "investors/me/dashboard", // GET ?months=1..36 (sukut 12) — KPI + oylik foyda
    ME_INVESTMENTS: "investors/me/investments", // GET ?from_date&to_date&page&limit — invested_at DESC
    ME_PROFITS: "investors/me/profits", // GET ?is_paid&page&limit — period_start DESC
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
    // POST { purpose: "market_group", group_type, market_id } → { token, expires_at, deep_link, command } — bir martalik, 10 daqiqa
    TELEGRAM_LINK_CODE: "telegram/link-code",
    // GET o'z marketining guruhlari holati (KJNHAlGW, market va market_operator; market_id faqat tokendan):
    // data — har doim 2 element [{ group_type, linked, is_active, linked_at, inactive_reason }]
    MY_TELEGRAM_GROUPS: "notifications/me/telegram-groups",
    // In-app inbox (current user, per-recipient rows) ──────────────────────
    INBOX: "notifications/inbox", // GET my inbox (is_read/type/category/priority/page/limit)
    INBOX_UNREAD_COUNT: "notifications/inbox/unread-count", // GET my unread count
    INBOX_COUNTS: "notifications/inbox/counts", // GET kategoriya bo'yicha jami/o'qilmagan + muhim o'qilmagan
    INBOX_READ_ALL: "notifications/inbox/read-all", // PATCH mark all read
    INBOX_BY_ID: (id: string | number) => `notifications/inbox/${id}`, // GET / DELETE one
    INBOX_READ: (id: string | number) => `notifications/inbox/${id}/read`, // PATCH read/unread
    DISPATCH: "notifications/dispatch", // POST manual dispatch (admin/testing)
    // GET bitta qo'lda yuborish: matn, jonli kanal × holat, yetkazilmaganlar (?page&limit) — id = client_request_id
    SENT_BY_ID: (dispatchId: string) => `notifications/sent/${encodeURIComponent(dispatchId)}`,
    // GET qo'lda yuborilgan xabarlar tarixi (?page&limit&status&created_by) — yangisi birinchi (NS-2, superadmin/admin)
    SENT: "notifications/sent",
    // Auditoriya va kampaniya (KM-2, superadmin/admin) ──────────────────────
    // POST nishon → aniq son, rollar kesimi, kanal bo'yicha yaroqlilar, ?with_sample — 20 ta maskalangan qator
    AUDIENCE_PREVIEW: "notifications/audience/preview",
    AUDIENCE_SEGMENTS: "notifications/audience/segments", // GET saqlangan segmentlar / POST saqlash (409 — nom band)
    AUDIENCE_SEGMENT_BY_ID: (id: string) => `notifications/audience/segments/${encodeURIComponent(id)}`, // DELETE
    CAMPAIGNS: "notifications/campaigns", // GET tarix (?page&limit&state) / POST yaratish (Idempotency-Key) → 202
    CAMPAIGN_SCHEDULE_POLICY: "notifications/campaigns/schedule-policy", // GET tungi taqiq (?scheduled_at&category)
    CAMPAIGN_BY_ID: (id: string) => `notifications/campaigns/${encodeURIComponent(id)}`, // GET progress
    CAMPAIGN_CANCEL: (id: string) => `notifications/campaigns/${encodeURIComponent(id)}/cancel`, // POST (409 — tugagan)
    CAMPAIGN_REPORT: (id: string) => `notifications/campaigns/${encodeURIComponent(id)}/report`, // GET
    CAMPAIGN_UNDELIVERED: (id: string) => `notifications/campaigns/${encodeURIComponent(id)}/undelivered`, // GET
    // GET CSV (faqat superadmin): ≤10 000 — fayl, kattasi — 202 { export_id }
    CAMPAIGN_UNDELIVERED_EXPORT: (id: string) =>
      `notifications/campaigns/${encodeURIComponent(id)}/undelivered/export`,
    CAMPAIGN_EXPORT_BY_ID: (exportId: string) => `notifications/campaigns/exports/${encodeURIComponent(exportId)}`,
    CAMPAIGN_EXPORT_DOWNLOAD: (exportId: string) =>
      `notifications/campaigns/exports/${encodeURIComponent(exportId)}/download`,
    // SMS kampaniyasi hisoboti (H7kpCman) — javob shakli bildirishnoma kampaniyasiniki bilan bir xil (`kind: 'sms'`)
    SMS_CAMPAIGN_REPORT: (id: string) => `notifications/sms/campaigns/${encodeURIComponent(id)}/report`, // GET
    SMS_CAMPAIGN_UNDELIVERED: (id: string) => `notifications/sms/campaigns/${encodeURIComponent(id)}/undelivered`,
    SMS_CAMPAIGN_UNDELIVERED_EXPORT: (id: string) =>
      `notifications/sms/campaigns/${encodeURIComponent(id)}/undelivered/export`, // GET CSV (faqat superadmin)
    // Web Push (current user's device) ─────────────────────────────────────
    PUSH_PUBLIC_KEY: "notifications/push/public-key", // GET VAPID public key
    PUSH_SUBSCRIBE: "notifications/push/subscribe", // POST save / DELETE remove this device
    // SMS (superadmin/admin) ───────────────────────────────────────────────
    SMS_STATUS: "notifications/sms/status",
    SMS_TARIFFS: "notifications/sms/tariffs",
    SMS_REPORT: "notifications/sms/report",
    SMS_ACCOUNTS: "notifications/sms/accounts", // GET list / PUT upsert (superadmin)
    SMS_TEMPLATES: "notifications/sms/templates", // GET list / POST upsert
    SMS_TEMPLATE_BY_ID: (id: string | number) => `notifications/sms/templates/${id}`,
    SMS_TEMPLATE_APPROVE: (id: string | number) => `notifications/sms/templates/${id}/approve`,
    SMS_CAMPAIGNS: "notifications/sms/campaigns", // GET history / POST send (Idempotency-Key)
    SMS_CAMPAIGN_PREVIEW: "notifications/sms/campaigns/preview",
    SMS_CAMPAIGN_CANCEL: (id: string | number) => `notifications/sms/campaigns/${id}/cancel`, // POST — faqat `scheduled` (KM-6)
    SMS_CONSENTS: "notifications/sms/consents",
    SMS_CONSENTS_REVOKE: "notifications/sms/consents/revoke",
  },

  // ── Branches (admin full; manager/branch scoped) — guide §8 ──────────────
  BRANCHES: {
    BASE: "branches", // GET list / POST create
    NEW_ORDERS: "branches/new-orders", // branches with NEW orders
    TREE: "branches/tree", // full nested tree
    WITH_SENT_BATCHES: "branches/with-sent-batches",
    TRANSFER_BATCHES: "branches/transfer-batches", // POST create batches from requester branch
    POST_DISPATCH: (postId: string | number) => `branches/posts/${postId}/dispatch`,
    // Pochta jo'natish oynasi uchun manzil filiallar (superadmin/admin/HQ registratori)
    DISPATCH_DESTINATIONS: "branches/dispatch-destinations",
    // Markaziy ombor (Pa1KaXmj): HQ filiali — «Ombor ochish» oynasi uchun (SUPERADMIN/ADMIN, pul maydonlarisiz;
    // 404 — HQ yo'q, 400 — eski backend: `branches/:id` ga tushadi)
    HQ: "branches/hq",
    BY_ID: (id: string | number) => `branches/${id}`, // GET / PATCH / DELETE
    DESCENDANTS: (id: string | number) => `branches/${id}/descendants`,
    ANALYTICS_MARKETS: (id: string | number) => `branches/${id}/analytics/markets`,
    RETURN_BATCHES: (id: string | number) => `branches/${id}/return-batches`,
    USERS: (id: string | number) => `branches/${id}/users`, // GET assigned / POST assign
    USER_BY_ID: (branchId: string | number, userId: string | number) =>
      `branches/${branchId}/users/${userId}`, // DELETE remove user from branch
    // Branch config — faqat `branchCoverage.useGetSettingById` (branch-ops) ishlatadi.
    SETTING_BY_ID: (branchId: string | number, key: string | number) =>
      `branches/${branchId}/config/${key}`, // GET / PATCH / DELETE by key
  },

  // ── Scan / QR (any-auth) ─────────────────────────────────────────────────
  SCAN: {
    BY_TOKEN: (token: string | number) => `scan/${token}`, // resolve QR → order/batch/post
    MARKET_CANCELLED: "scan/market-cancelled", // POST { qr_token } yoki { market_id, pin } (zkRab9M2) → topshirish ruxsati
  },

  // ── Telegram scan Mini App (courier; `/tg/scan`, MWYaqprw) ───────────────
  TELEGRAM_SCAN: {
    DONE: "telegram/scan/done", // POST { order_ids } → { accepted, ignored }; bot sends the summary
  },

  // ── Files (MinIO) — guide §10 ────────────────────────────────────────────
  FILES: {
    UPLOAD: "files/upload", // POST multipart/form-data
    PDF: "files/pdf", // POST generate PDF
    QR: "files/qr", // POST generate QR
    BY_KEY: (key: string) => `files/${key}`, // GET signed URL / DELETE
    // GET faylning o'zi (JWT + egalik tekshiruvi) — maxfiy dalillar uchun; MinIO brauzerga ochiq emas.
    CONTENT: (key: string) => `files/${key}/content`,
  },

  // ── Excel export (binary .xlsx — don't JSON-parse) — guide §10 ───────────
  EXPORT: {
    ORDERS_XLSX: "export/orders.xlsx",
    CASHBOX_HISTORY_XLSX: "export/cashbox-history.xlsx",
    SHIFTS_XLSX: "export/shifts.xlsx",
    FINANCIAL_BALANCE_XLSX: "export/financial-balance.xlsx", // Balans → Tarix filtrlari bilan
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

  // ── AI admin (api-gateway `AiGatewayController`, SUPERADMIN/ADMIN) ───────
  AI: {
    // GET { enabled, key_state, models, model_policy, cap, usage_persist_failures } — kalit QIYMATI yo'q (OS-2)
    STATUS: "ai/status",
  },

  // ── Webhooks (public — provider inbound, no JWT) ─────────────────────────
  WEBHOOKS: {
    BY_SLUG: (slug: string | number) => `webhooks/${slug}`, // POST
  },

  // ── Partners (admin) — Partner API hamkorlarini boshqarish ───────────────
  PARTNERS: {
    BASE: "admin/partners", // GET ro'yxat / POST yaratish (kalit BIR MARTA)
    BY_ID: (id: string | number) => `admin/partners/${id}`, // PATCH sozlamalar
    ROTATE_KEY: (id: string | number) => `admin/partners/${id}/rotate-key`, // POST
    STATUS: (id: string | number) => `admin/partners/${id}/status`, // POST faol/o'chiq
    // ⚠️ `:id` marshrutlaridan OLDIN e'lon qilingan — aks holda "webhooks"
    // hamkor id'si deb o'qilardi.
    WEBHOOKS: "admin/partners/webhooks", // GET outbox jurnali
    WEBHOOK_RETRY: (id: string | number) => `admin/partners/webhooks/${id}/retry`, // POST qayta navbatga
    // SINOV webhooki — haqiqiy buyurtmaga tegmaydi. Tanada `url` berilsa
    // saqlangan manzildan ustun turadi (saqlashdan OLDIN sinash uchun).
    WEBHOOK_TEST: (id: string | number) => `admin/partners/${id}/webhook-test`, // POST
    // Hamkordan kelgan posilkalar bog'lanishi (yupqa: status buyurtmada).
    SHIPMENTS: (id: string | number) => `admin/partners/${id}/shipments`, // GET
  },

  // ── Ombor (vaqtinchalik ombor tizimi; yXC91RRx, backend hY7uacJu / Elchi-Backend#566) ──────────
  // Javoblar o'ramsiz: ro'yxat `{ data, total, page, limit, … }`. Yozish — SUPERADMIN, ADMIN; o'qish — + MANAGER (o'z
  // filiali). Kirim va inventarizatsiya — `Idempotency-Key` MAJBURIY (8–128 `[A-Za-z0-9._:-]`).
  WAREHOUSES: {
    BASE: "warehouses", // GET ?status&region_id&search&page&limit → { data, total, page, limit, counts, summary } · POST ochish
    BY_ID: (id: string | number) => `warehouses/${id}`, // GET (+ movements_count) · PATCH (name, manager_user_id, address, low_stock_default, note)
    PAUSE: (id: string | number) => `warehouses/${id}/pause`, // POST { note? }
    RESUME: (id: string | number) => `warehouses/${id}/resume`, // POST { note? }
    STOCK: (id: string | number) => `warehouses/${id}/stock`, // GET ?market_id&level=ok,low,out&search&page&limit → { data, facets }
    STOCK_THRESHOLD: (id: string | number, productId: string | number) =>
      `warehouses/${id}/stock/${productId}`, // PATCH { low_stock_threshold: number | null }
    MOVEMENTS: (id: string | number) => `warehouses/${id}/movements`, // GET ?type&product_id&market_id&ref_type&ref_id&from&to&page&limit
    LOOKUP: (id: string | number) => `warehouses/${id}/lookup`, // GET ?code&market_id → { matched_by, data: [{ product, market, stock }] }
    STOCK_IN: (id: string | number) => `warehouses/${id}/stock-in`, // POST { lines: [{ product_id | code, qty }], market_id?, note? }
    INVENTORY: (id: string | number) => `warehouses/${id}/inventory`, // POST { lines: [{ product_id | code, counted }], reason, market_id? }
    EXPORT: (id: string | number) => `warehouses/${id}/export`, // GET ?market_id&level&search → .xlsx
    // «Ombordagi qoldiq» — market (faqat o'zi), market operatori, SUPERADMIN/ADMIN (`market_id` majburiy)
    MARKET_STOCK: "market/warehouse-stock", // GET ?market_id&search&low_only&page&limit
    // Market «Ombordan buyurtma yaratish» kaliti — SUPERADMIN, ADMIN
    MARKET_WAREHOUSE_ORDER: (marketId: string | number) => `markets/${marketId}/warehouse-order`, // PATCH { can_order_from_warehouse }
    // 6kHnNH9j: buyurtma formasi — manba oldindan ko'rinishi (faqat hisoblaydi, band qilmaydi). SUPERADMIN, ADMIN,
    // REGISTRATOR, MARKET (kalit bilan), MARKET_OPERATOR. POST { district_id, region_id?, market_id?, items: [{ product_id,
    // quantity }] } → { source: HQ | WAREHOUSE, reason, warehouse, items: [{ product_id, required, available, enough }], shortages }
    RESOLVE_SOURCE: "warehouses/resolve-source",
    // GET ?district_id&region_id&market_id|product_ids → { region_id, warehouse | null (PAUSED — items []), items:
    // [{ product_id, on_hand, reserved, available }] } — katalogdagi «Omborda: N» (faqat qatori bor mahsulotlar)
    AVAILABILITY: "warehouses/availability",
  },

  // QKCeGZ3N (4-band): ilova xato chegarasi hisoboti — POST { code, message, path, stack?, component_stack?, scope? } → 204
  // (gateway jurnaliga `client_error`, bazaga emas). Har qanday kirgan foydalanuvchi.
  CLIENT_ERRORS: "client-errors",

  // ── Activity logs / audit trail (admin) — merged across services ─────────
  ACTIVITY_LOGS: {
    BASE: "activity-logs", // GET audit feed (filters: service/entity/action/user/date/search)
    ACTIONS: "activity-logs/actions", // GET known action verbs (filter dropdown)
    ENTITY: (entityType: string, entityId: string | number) =>
      `activity-logs/entity/${entityType}/${entityId}`, // GET full history of one entity
    USER: (userId: string | number) => `activity-logs/user/${userId}`, // GET everything a user did
  },
} as const;
