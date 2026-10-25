export type UserRole =
  | "admin"
  | "manager"
  | "registrator"
  | "marketing"
  | "operator"
  | "courier"
  | "market"
  | "superadmin"
  | "customer"
  // Backend `Roles` (libs/common/enums): yangi rollar — logist (dzyVftBx), market operatori, investor
  // va filial hisobi (`branch`, faqat yorliq). Ularning qobig'i `menuConfig.tsx` da (ROL-0).
  | "logist"
  | "market_operator"
  | "investor"
  | "branch";

export type UserStatus = "active" | "inactive" | "blocked";

export type ExpenseProofCondition =
  | "sell_any"
  | "sell_extra_cost"
  | "sell_zero_total"
  | "cancel_any"
  | "cancel_extra_cost"
  | "cancel_zero_total";

export interface OrderItem {
  id: string;
  product_id: string;
  order_id: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  market_id: string;
  customer_id: string;
  product_quantity: number;
  where_deliver: "home" | "center";
  total_price: number;
  to_be_paid: number;
  paid_amount: number;
  status: string;
  comment: string | null;
  district_id: string;
  region_id: string;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}

// Region ma'lumotlari (courier uchun)
export interface Region {
  id: string;
  name: string;
  sato_code: string;
  createdAt: string;
  updatedAt: string;
}

// Backend dan kelgan user ma'lumotlari
export interface User {
  id: string;
  name: string; // Backend: name
  phone_number: string; // Backend: phone_number
  username: string;
  role: UserRole;
  status: UserStatus;
  salary: number;
  payment_day: string | null;
  createdAt: string;
  updatedAt: string;
  is_deleted: boolean;
  tariff_home: number | null;
  tariff_center: number | null;
  add_order?: boolean;
  can_add_extra_cost?: boolean;
  can_sell_cancel?: boolean;
  cancelled_handover_qr_required?: boolean;
  expense_proof_conditions?: ExpenseProofCondition[] | null;
  /**
   * Shaxsiy Telegram botga ulanganmi (td89SKXQ). Backend xom `telegram_id` ni
   * qaytarmaydi — faqat shu holat; `telegram_username` va `telegram_linked_at`
   * esa ulangan bo'lsa keladi (`GET /auth/my-profile`).
   */
  telegram_linked?: boolean;
  telegram_username?: string | null;
  telegram_linked_at?: string | null;
  /**
   * (ysBqD9Nx) Market Telegram GURUHIDAGI buyurtma kartalarida mijoz ismi va telefoni ko'rinadimi.
   * Backend sukuti `true`; `false` — ism yashirin, telefon niqoblangan. Faqat market qatorida.
   */
  tg_group_show_customer_pii?: boolean;
  default_tariff: "home" | "center";
  /** NFiXfmq6: market AI buyurtma narxi (so'm). `null` / yo'q — global narx (sukut ko'rsatilmaydi, FY-S5). */
  ai_price_per_order?: number | string | null;
  /**
   * yXC91RRx: market «Ombordan buyurtma yaratish» kaliti (sukut `false`; faqat superadmin/admin o'zgartiradi —
   * `PATCH /markets/:id/warehouse-order`). Faqat market qatorida.
   */
  can_order_from_warehouse?: boolean;
  region_id?: string | null;
  region?: Region | null;
  /**
   * MO-2: market operatori qaysi marketga biriktirilgan (`GET auth/my-profile` → `market_id`; market nomi kelmaydi —
   * N13). Boshqa rollarda yo'q yoki `null`.
   */
  market_id?: string | number | null;
  /**
   * MO-2: market operatorining komissiyasi (`my-profile`, identity `User.commission_*`): `percent` — sotilgan
   * buyurtma narxidan foiz, `fixed` — har sotuvga so'm. Turi `null` yoki qiymati 0 — daromad yozilmaydi.
   * `numeric(14,2)` — qiymat son yoki matn bo'lib kelishi mumkin.
   */
  commission_type?: "percent" | "fixed" | null;
  commission_value?: number | string | null;
  /**
   * XtcEyQjb: market operatori «Ombordagi qoldiq» ni ko'radimi (`GET /auth/my-profile`; market har operatorga alohida
   * yoqadi, sukut `false`). Boshqa rollarda yo'q.
   */
  can_view_warehouse_stock?: boolean;
  /**
   * kGIjOciz (backend 914ff57, prod): foydalanuvchi biriktirilgan filial (`branch_users` dan) — kuryer, menejer,
   * registrator, filial xodimi; boshqalarda yoki filial xizmati javob bermasa `null`.
   */
  branch_id?: string | number | null;
  branch?: { id: string | number; name: string } | null;
  /** x6IO746K: market operatori marketi (`GET /users`, `/users/:id`); boshqa rollarda yo'q. */
  market?: { id: string | number; name: string; add_order?: boolean } | null;
  avatar?: string;
  balance?: number;
  orders?: Order[];
}

export interface UserStats {
  total: number;
  markets: number;
  employees: number;
}

// Backend response strukturasi
export interface UserListResponse {
  success: boolean;
  data: {
    items: User[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      totalMarket?: number;
      totalEmployees?: number;
      totalUsers?: number;
    };
  };
}

// ==================== CREATE ADMIN ====================

// Admin yaratish uchun request body
export interface CreateAdminRequest {
  name: string; // Admin ismi
  phone_number: string; // Telefon raqam (+998...)
  password: string; // Parol
  salary: number; // Maosh (so'm)
  payment_day: number; // To'lov kuni (1-31)
}

export interface CreateRegistratorRequest extends CreateAdminRequest {
  branch_id: string;
}

export interface CreateManagerRequest {
  name: string;
  phone_number: string;
  password: string;
  salary?: number;
  payment_day?: number;
  tariff_home?: number;
  tariff_center?: number;
  branch_id: string;
}

// Admin yaratish response
export interface CreateAdminResponse {
  success: boolean;
  data: User; // Yaratilgan admin ma'lumotlari
}

// ==================== CREATE MARKET ====================

// Market yaratish uchun request body
export interface CreateMarketRequest {
  name: string; // Market nomi
  phone_number: string; // Telefon (+998...)
  username: string; // Username
  password: string; // Parol
  tariff_home: number; // Uyga tarif (so'm)
  tariff_center: number; // Markazga tarif (so'm)
  default_tariff: "address" | "center"; // Asosiy tarif turi
}

// Market yaratish response
export interface CreateMarketResponse {
  success: boolean;
  data: User;
}

// ==================== CREATE COURIER ====================

// `region_id` yo'q: gateway `CreateCourierRequestDto` da bu maydon yo'q (400 «should not exist») — kuryer hududi
// filial biriktiruvidan keladi (LG-2 tozalash).
export interface CreateCourierRequest {
  branch_id?: string;
  name: string; // Kuryer ismi
  phone_number: string; // Telefon (+998...)
  password: string; // Parol
  salary?: number;
  payment_day?: number;
  tariff_home?: number; // Uyga tarif (so'm)
  tariff_center?: number; // Markazga tarif (so'm)
}

// ==================== CREATE LOGIST ====================

/**
 * `POST /logists` (superadmin, admin; dzyVftBx) — admin naqshi: ism, telefon, parol, maosh (majburiy), to'lov kuni
 * (ixtiyoriy). `branch_id` yo'q — logist filialga biriktirilmaydi, viloyatlar `POST /region/logist/bulk` bilan.
 */
export interface CreateLogistRequest {
  name: string;
  phone_number: string;
  password: string;
  salary: number;
  payment_day?: number;
}

// ==================== USER DETAIL ====================

export interface UserDetailResponse {
  success: boolean;
  data: User;
}

// ==================== UPDATE USER ====================

export interface UpdateUserRequest {
  name?: string;
  phone_number?: string;
  username?: string;
  password?: string;
  status?: UserStatus;
  salary?: number;
  payment_day?: number;
  tariff_home?: number;
  tariff_center?: number;
  add_order?: boolean;
  can_add_extra_cost?: boolean;
  can_sell_cancel?: boolean;
  default_tariff?: "address" | "center";
  /**
   * NFiXfmq6: market AI buyurtma narxi (so'm, 1 ta buyurtma). `null` — global narx; 0 — bepul. Faqat
   * superadmin/admin va faqat market yozuvida (backend boshqasiga 403/400). `region_id` olib tashlandi (FY-1):
   * identity `updateUser` uni e'tiborsiz qoldiradi — kuryer hududi filial biriktiruvidan keladi.
   */
  ai_price_per_order?: number | null;
}

// ==================== CHANGE ROLE (FY-2) ====================

/**
 * K3scaE0W — `PATCH /users/:id/role` da manba ham, nishon ham bo'la oladigan rollar (backend `CHANGEABLE_ROLES`:
 * pul/hisob bog'lanmagan xodimlar). Kuryer, market, operator, investor va superadmin almashtirilmaydi.
 */
export type ChangeableUserRole = "admin" | "manager" | "registrator" | "logist";

export interface ChangeUserRoleRequest {
  role: ChangeableUserRole;
}

/** `GET /roles` — frontend faqat `changeable_roles` ni oladi (katalog yorliqlari faqat o'zbekcha, nomlar i18n'dan). */
export interface RoleCatalog {
  changeableRoles: ChangeableUserRole[];
}
