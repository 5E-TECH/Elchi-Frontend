import { useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/config/store";
import { normalizeCashboxShift, useCashBox, type CashboxShift } from "../../../../entities/payments";
import { useUser } from "../../../../entities/user/api/userApi";

/**
 * KASSA SMENASI HOLATI (kfdfYDik, ega javoblari CB-S1…S5).
 *
 * Manba — `GET finance/shift/current` (kassa doirasi JWT'dan: superadmin/admin — asosiy kassa, menejer — o'z
 * filiali kassasi). `shift` — faqat OCHIQ smena yoki `null`; yopilgan smena (`last_closed`) hali kelmaydi
 * (Taklif · backend kerak, CB-3).
 *
 *  - `status`: `"open"` · `"closed"` (smena yo'q — qulf, ega S4: `required` dan qat'i nazar) · `"loading"` ·
 *    `"unknown"` (rol smenani boshqarmaydi, so'rov xato bergan — masalan filiali topilmagan menejerga 403).
 *    Noma'lum holatda smena amali taklif qilinmaydi va qulf chizilmaydi (backend darvozasi baribir tekshiradi).
 *  - `openedByName`: ochgan xodim — o'zi bo'lsa profil ismi, aks holda `GET users/:id` (jim); topilmasa «—».
 */

export type CashboxShiftStatus = "open" | "closed" | "loading" | "unknown";

export type CashboxShiftState = {
  status: CashboxShiftStatus;
  /** Smenani ochish/yopish huquqi bor rol (superadmin, admin, menejer). */
  canManage: boolean;
  shift: CashboxShift | null;
  /** Backend darvozasi yoqilganmi (`FINANCE_REQUIRE_OPEN_SHIFT`); qulf bunga qaramaydi (ega S4). */
  required: boolean;
  /** Ochgan xodim ismi; noma'lum — «—». Smena yo'q bo'lsa `null`. */
  openedByName: string | null;
  /** Joriy foydalanuvchi ismi (ochish oynasidagi «Ochadigan xodim», natijadagi «Yopgan xodim»). */
  currentUserName: string;
  /** Joriy foydalanuvchi ID si (raqamli satr) yoki "". */
  currentUserId: string;
  refetch: () => void;
};

export const SHIFT_MANAGER_ROLES: ReadonlySet<string> = new Set(["superadmin", "admin", "manager"]);

const DASH = "—";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const getText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : "");

/** Foydalanuvchi ismi `GET users/:id` javobidan (`data` ichida yoki to'g'ridan-to'g'ri). */
export const resolveUserName = (payload: unknown): string => {
  const root = asRecord(payload);
  const user = asRecord(root.data && typeof root.data === "object" ? root.data : root);
  const nested = asRecord(user.user);
  return (
    getText(user.name) ||
    getText(user.full_name) ||
    [getText(user.first_name), getText(user.last_name)].filter(Boolean).join(" ") ||
    getText(nested.name) ||
    ""
  );
};

export const useCashboxShift = ({ enabled = true }: { enabled?: boolean } = {}): CashboxShiftState => {
  const role = useSelector((state: RootState) => state.role.role);
  const roleName = useSelector((state: RootState) => state.role.name);
  const profile = useSelector((state: RootState) => state.user.user);
  const roleUserId = useSelector((state: RootState) => state.role.id);

  const canManage = SHIFT_MANAGER_ROLES.has(String(role ?? "").toLowerCase());
  const profileRecord = asRecord(profile);
  const currentUserId = String(profileRecord.id ?? roleUserId ?? "").trim();
  const currentUserName = getText(profileRecord.name) || getText(roleName);

  const { useGetCurrentShift } = useCashBox();
  const query = useGetCurrentShift(enabled && canManage);

  const shift = useMemo(() => {
    const value = normalizeCashboxShift(asRecord(query.data?.data).shift);
    return value && value.status === "open" ? value : null;
  }, [query.data]);
  const required = Boolean(asRecord(query.data?.data).required);

  const openedBy = shift?.opened_by ?? "";
  const isSelf = Boolean(openedBy) && openedBy === currentUserId;
  const { useGetUserById } = useUser();
  // Boshqa xodim ochgan smena — ismi `GET users/:id` dan (jim; xato bo'lsa «—»).
  const openerQuery = useGetUserById(openedBy && !isSelf ? openedBy : "", undefined, { silentError: true });

  const openedByName = !shift
    ? null
    : isSelf
      ? currentUserName || DASH
      : resolveUserName(openerQuery.data) || DASH;

  const { refetch: refetchQuery } = query;
  const refetch = useCallback(() => void refetchQuery(), [refetchQuery]);

  const status: CashboxShiftStatus =
    !enabled || !canManage
      ? "unknown"
      : query.isSuccess
        ? shift
          ? "open"
          : "closed"
        : query.isError
          ? "unknown"
          : "loading";

  return {
    status,
    canManage,
    shift,
    required,
    openedByName,
    currentUserName,
    currentUserId,
    refetch,
  };
};

export default useCashboxShift;
