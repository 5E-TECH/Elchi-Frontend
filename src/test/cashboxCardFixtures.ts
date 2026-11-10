import { formatMoneyLocalized } from "../shared/lib/formatMoney";

/**
 * cards1111 testlari uchun umumiy ma'lumotlar: kassa kartalari ro'yxati (`GET finance/cashbox/cards`), rollar holati va
 * HTTP xato yasovchi. HTTP mock'ning o'zi (`vi.hoisted` + `vi.mock`) har test faylida — vitest hoisting talabi.
 */

export const CARD_ROWS = [
  {
    id: "1",
    name: "Asosiy karta",
    balance: 2_140_000,
    is_default: true,
    is_active: true,
    sort_order: 0,
    kind: "plastic_card",
    bank_name: "Agrobank",
    card_network: "Uzcard",
    last4: "1234",
    holder_name: "Shodiyor Ergashev",
    note: null,
    require_photo_on_shift_close: true,
    ai_check_enabled: true,
    created_at: "2026-10-20T09:00:00.000Z",
  },
  {
    id: "2",
    name: "Humo virtual",
    balance: 1_850_000,
    is_default: false,
    is_active: true,
    sort_order: 1,
    kind: "virtual_card",
    bank_name: "Hamkorbank",
    card_network: "Humo",
    last4: "4417",
    holder_name: "Aziz Rahimov",
    note: null,
    require_photo_on_shift_close: false,
    ai_check_enabled: false,
    created_at: "2026-10-21T09:00:00.000Z",
  },
  {
    id: "3",
    name: "Bo'sh karta",
    balance: 0,
    is_default: false,
    is_active: true,
    sort_order: 2,
    kind: "bank_account",
    bank_name: "Ipoteka bank",
    card_network: null,
    last4: "2205",
    holder_name: null,
    note: null,
    require_photo_on_shift_close: false,
    ai_check_enabled: false,
    created_at: "2026-10-22T09:00:00.000Z",
  },
  {
    id: "4",
    name: "Eski karta",
    balance: 0,
    is_default: false,
    is_active: false,
    sort_order: 3,
    kind: "plastic_card",
    bank_name: null,
    card_network: null,
    last4: null,
    holder_name: null,
    note: null,
    require_photo_on_shift_close: false,
    ai_check_enabled: false,
    created_at: "2026-10-01T09:00:00.000Z",
  },
];

export const CARD_LIST = {
  cashbox_id: "1",
  cashbox_type: "main",
  branch_id: null,
  cards: CARD_ROWS,
  balance_card: 3_990_000,
  named_total: 1_850_000,
  default_balance: 2_140_000,
  total_card: 3_990_000,
  in_sync: true,
};

export const OPEN_SHIFT = {
  shift: { id: "31", opened_by: "1", opened_at: "2026-11-11T04:00:00.000Z", status: "open", closed_by: null },
  required: true,
  cashbox_user_id: "0",
};

export const money = (value: number) => formatMoneyLocalized(value, { language: "uz" });

/** Axios xatosi shakli (`axios.isAxiosError` → `true`): backend javobi bilan. */
export const httpError = (status: number, message: string) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data: { statusCode: status, message } },
  });

const userState = (id: string, role: string, name: string) => ({
  role: { id, role, region: null, name },
  user: {
    user: { id, name, role },
    isAuthenticated: true,
    accessToken: "token",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
});

export const superadmin = userState("1", "superadmin", "Shodiyor Ergashev") as never;
export const admin = userState("7", "admin", "Admin 7") as never;
export const manager = userState("522", "manager", "Menejer 522") as never;
