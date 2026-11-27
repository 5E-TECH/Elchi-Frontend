// dizayn-v2: superadmin-payments-market-picker-dialog, superadmin-payments-to-give-dialog, admin-payments-to-give-dialog, admin-payments-to-receive-dialog, manager-payments-courier-select-dialog
import { memo, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDownLeft, Building2, Check, SearchX, Store, Truck, Wallet, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { useMarkets } from "../../../entities/markets";
import { useManagerMarkets, type ManagerMarketShare } from "../../../entities/payments/managerMarkets";
import { getBackendMessage, getErrorStatus } from "../../../shared/lib/errorKind";
import { cx } from "../../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  SkeletonList,
  TextInput,
} from "../../../shared/ui/primitives";
import InactiveBadge from "./InactiveBadge";
import {
  getReceiveDetailTarget,
  isInactiveStatus,
  isListedSettlementRow,
  RECEIVE_SEARCH_KEYS,
  useReceiveOptions,
  type ReceiveOption,
} from "./lib/receiveOptions";
import { FULL_LIST_LIMIT } from "../../../shared/config/listLimits";

/**
 * HISOB-KITOB TANLASH OYNASI — /payments va «Asosiy kassa» uchun umumiy (dizayn v2, eski `PopupSelect` o'rniga).
 *
 * Maketlar: `superadmin-payments-market-picker-dialog` = `admin-payments-to-receive-dialog` («Qabul qilinishi
 * kerak»: «Filiallar» — filial menejerlari va menejersiz filiallar, «HQ kuryerlari»), `*-payments-to-give-dialog`
 * («Berilishi kerak» — marketlar), `manager-payments-courier-select-dialog` («Kuryerni tanlang» — o'z filiali
 * kuryerlari). `Dialog` lg (telefonda pastki varaqa): sarlavha + izoh (jami summa), qidiruv, `listbox` (radio
 * qatorlar, guruh sarlavhalari), pastda «Bekor qilish» / «Tanlash» (tanlanmaguncha o'chiq).
 *
 * Xulq (eski oyna bilan bir xil): qatorni bosish — tanlash, ikki marta bosish — tanlab darhol «Tanlash»
 * (`onSelect` bir marta). Klaviatura (fokus qidiruvda, `aria-activedescendant`): ↑ ↓ Home End — tanlovni
 * siljitish, Enter — «Tanlash». Qator kaliti `${kind}:${id}` (filial 15 va kuryer 15 aralashmasin), market — `id`.
 *
 * Ma'lumot faqat oyna ochiqligida: receive/courier — `useReceiveOptions` (`status=active` YO'Q, FE-PAY-13 —
 * bloklangan, lekin puli qolgan qator «Nofaol» belgisi bilan chiqadi); give — superadmin/admin: `GET /markets?limit=10000`
 * (`status` YO'Q, puli yo'q bloklangan market chiqmaydi). Tanlov navigatsiyasini chaqiruvchi qiladi.
 *
 * Qidiruv limitlari (2026-11-27): backend ilgari `limit` ni 100 bilan kesardi — 101-market na ro'yxatda, na qidiruvda
 * chiqardi. Endi backend `FULL_LIST_LIMIT` (10 000) gacha beradi; qidiruv — market nomi, telefoni yoki ID si.
 *
 * Maketdan farq (Spt8Cj7m, TC matni): «Berilishi kerak» da 0 so'mli market sukut bo'yicha ko'rinmaydi, faqat qidiruvda.
 *
 * MENEJER «Berilishi kerak» (63HO6cBU, BE PR-C; maket yo'q — eng yaqini `superadmin-payments-to-give-dialog`): faqat
 * o'z filiali marketlari — `GET /finance/cashbox/manager/markets` (`GET /markets` EMAS), qator summasi — «To'lash
 * mumkin» (`payable`, to'lov chegarasi; filial ulushi `branch_share` emas). «To'lash mumkin» 0 bo'lgan market ham
 * ro'yxatda, lekin tanlab bo'lmaydi (`aria-disabled`, xira). Bo'sh — «Bu filialga buyurtma topshiradigan market yo'q»;
 * 503 («Filial ulushini tekshirib bo'lmadi …») — bo'sh ro'yxat emas, xato holati + «Qayta urinish». Qidiruv — yuklangan
 * ro'yxat ichida (nomi yoki ID si).
 */

export type SettlementPickerKind = "receive" | "give" | "courier";

export interface SettlementPickerTarget {
  path: string;
  state: unknown;
}

export interface SettlementPickerDialogProps {
  /** receive — superadmin/admin qabul; give — marketga to'lov; courier — menejer kuryerdan qabul. */
  kind: SettlementPickerKind;
  open: boolean;
  onClose: () => void;
  /** Tanlangan qatorning kassa sahifasi — `navigate(path, { state })` ni chaqiruvchi qiladi. */
  onSelect: (target: SettlementPickerTarget) => void;
  /** Izohdagi «jami» (berilmasa — ro'yxat summalaridan). */
  total?: number;
  /** courier: guruh sarlavhasi «{filial} kuryerlari · N ta». */
  branchName?: string;
}

/** «Berilishi kerak» oynasidagi market qatori (`entity` sifatida kassa sahifasiga o'tadi — eski shakl). */
export type PaymentMarketOption = {
  id: string;
  name: string;
  phone_number: string;
  role: string;
  cashbox?: unknown;
  amount: number;
  /** Market bloklangan — faqat puli qolgan bo'lsa ro'yxatda, belgi bilan. */
  is_inactive: boolean;
};

type UnknownRecord = Record<string, unknown>;

type PickerRow = {
  key: string;
  group?: "branches" | "hqCouriers";
  icon: LucideIcon;
  name: string;
  subtitle: string;
  amount: number;
  inactive: boolean;
  /** Tanlab bo'lmaydi (menejer: «To'lash mumkin» 0) — ro'yxatda turadi, lekin xira. */
  disabled?: boolean;
  search: string;
  target: SettlementPickerTarget;
};


const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" ? (value as UnknownRecord) : {};

const getRecordString = (record: UnknownRecord, key: string, fallback = "") => {
  const value = record[key];
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return fallback;
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDataItems = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.data)) return record.data;
  const data = asRecord(record.data);
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
};

/**
 * GET /markets → «Berilishi kerak» qatorlari: summa `berilishi_kerak` → `cashbox.berilishi_kerak` →
 * `cashbox.balance` → `amount`; faol bo'lmagan market faqat puli bo'lsa (FE-PAY-13).
 */
const toPaymentMarketOptions = (source: unknown): PaymentMarketOption[] =>
  toDataItems(source)
    .map((market: unknown) => {
      const m = asRecord(market);
      const cashbox = asRecord(m.cashbox);

      return {
        id: getRecordString(m, "id"),
        name: getRecordString(m, "name"),
        phone_number: getRecordString(m, "phone_number", getRecordString(m, "phone")),
        role: getRecordString(m, "role", "market"),
        cashbox: m.cashbox,
        amount: toNumber(m.berilishi_kerak ?? cashbox.berilishi_kerak ?? cashbox.balance ?? m.amount),
        is_inactive: isInactiveStatus(m.status),
      };
    })
    .filter((market: PaymentMarketOption) => market.id && isListedSettlementRow(market));

const digitsOf = (value: string) => value.replace(/\D/g, "");

const searchText = (values: readonly unknown[]) => {
  const text = values
    .map((value) => (typeof value === "string" || typeof value === "number" ? String(value) : ""))
    .filter(Boolean)
    .join(" ");
  return `${text.toLowerCase()} ${digitsOf(text)}`;
};

const matchesQuery = (row: PickerRow, query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  if (row.search.includes(normalized)) return true;
  // Telefon raqami bo'shliq/«+» bilan yozilsa ham topilsin.
  const digits = digitsOf(normalized);
  return digits.length >= 3 && digits.length === normalized.replace(/[\s+()-]/g, "").length
    ? row.search.includes(digits)
    : false;
};

/**
 * Summa bo'yicha kamayish tartibida (Spt8Cj7m; maketlar `*-payments-to-give-dialog`, `*-to-receive-dialog`): eng katta
 * qarzdor tepada, «Nofaol» ham summasiga qarab, manfiy qoldiq oxirida. Teng summalar avvalgi tartibda qoladi.
 */
const byAmountDesc = (rows: readonly PickerRow[]) => [...rows].sort((left, right) => right.amount - left.amount);

/**
 * Menejer qatori: summa — «To'lash mumkin» (`payable`); 0 (yoki manfiy) — tanlab bo'lmaydi. Kassa sahifasiga `entity`
 * (eski shakl) — summa ham `payable`.
 */
const toManagerMarketRow = (market: ManagerMarketShare): PickerRow => {
  const inactive = isInactiveStatus(market.status);
  const entity: PaymentMarketOption = {
    id: market.marketId,
    name: market.name,
    phone_number: "",
    role: "market",
    amount: market.payable,
    is_inactive: inactive,
  };
  return {
    key: market.marketId,
    icon: Store,
    name: market.name,
    subtitle: "",
    amount: market.payable,
    inactive,
    disabled: !(market.payable > 0),
    search: searchText([market.name, market.marketId]),
    target: {
      path: `/payments/cash-detail/${market.marketId}?type=market`,
      state: { type: "market", entity },
    },
  };
};

/** Matndagi summa bir qatorda qoladi (mingliklar ajratkichi oddiy bo'shliq — «jami 2 / 150 000» bo'linmasin). */
const withNowrapAmount = (text: string, amount: string): ReactNode => {
  const at = text.lastIndexOf(amount);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <span className="whitespace-nowrap">{amount}</span>
      {text.slice(at + amount.length)}
    </>
  );
};

/** Faqat 503 da backendning o'zbekcha sababi («Filial ulushini tekshirib bo'lmadi …») — xato izohida. */
const shareCheckMessage = (error: unknown) =>
  getErrorStatus(error) === 503 ? getBackendMessage(error) : undefined;

/** `.el-option` — tanlash oynasidagi qator (min 56 px, radio belgi, telefonda ikonka yashirin). */
const ROW =
  "flex min-h-14 w-full cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-text " +
  "transition-[background-color] duration-150 motion-reduce:transition-none";
/** Tanlab bo'lmaydigan qator — `Select` dagi o'chiq variant kabi (`cursor-not-allowed text-text-subtle`). */
const DISABLED_ROW = "cursor-not-allowed text-text-subtle";

const KIND_ICON: Record<SettlementPickerKind, LucideIcon> = {
  receive: ArrowDownLeft,
  give: Store,
  courier: Truck,
};

const SettlementPickerDialog = ({
  kind,
  open,
  onClose,
  onSelect,
  total,
  branchName,
}: SettlementPickerDialogProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const listId = useId();
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const isMarketList = kind === "give";
  const role = useSelector((state: RootState) => state.role.role);
  // 63HO6cBU (PR-C): menejer faqat o'z filiali marketlariga, «To'lash mumkin» doirasida to'laydi.
  const isManagerMarketList = isMarketList && String(role).toLowerCase() === "manager";
  const receive = useReceiveOptions({ isManagerRole: kind === "courier", enabled: open && !isMarketList });
  const { useGetMarkets } = useMarkets();
  // `status: "active"` YO'Q (FE-PAY-13): bloklangan, lekin puli qolgan market ham to'lanishi kerak.
  const marketsQuery = useGetMarkets({ limit: FULL_LIST_LIMIT }, open && isMarketList && !isManagerMarketList);
  const managerMarketsQuery = useManagerMarkets(open && isManagerMarketList);

  const money = (value: number) => formatMoneyLocalized(value, { language });

  const rows = useMemo<PickerRow[]>(() => {
    if (isManagerMarketList) {
      return (managerMarketsQuery.data?.items ?? []).map(toManagerMarketRow);
    }
    if (isMarketList) {
      return toPaymentMarketOptions(marketsQuery.data).map((market) => ({
        key: market.id,
        icon: Store,
        name: market.name,
        subtitle: "",
        amount: market.amount,
        inactive: market.is_inactive,
        // «Foydalanuvchilar» qidiruvi kabi: nomi, telefoni yoki ID si.
        search: searchText([market.name, market.phone_number, market.id]),
        target: {
          path: `/payments/cash-detail/${market.id}?type=market`,
          state: { type: "market", entity: market },
        },
      }));
    }

    return receive.options.map((option: ReceiveOption) => {
      const phone = option.phone_number ? formatPhone(option.phone_number) : "";
      let subtitle = option.subtitle;
      if (option.kind === "courier" && kind === "receive") {
        subtitle = phone ? `${t("hqCourierLabel")} · ${phone}` : t("hqCourierLabel");
      } else if (option.kind === "courier") {
        subtitle = [option.region, phone].filter(Boolean).join(" · ");
      }
      return {
        key: option.key,
        group: kind === "receive" ? (option.kind === "branch" ? "branches" : "hqCouriers") : undefined,
        icon: option.kind === "branch" ? Building2 : Truck,
        name: option.name,
        subtitle,
        amount: option.amount,
        inactive: option.is_inactive,
        search: searchText(RECEIVE_SEARCH_KEYS.map((key) => option[key])),
        target: getReceiveDetailTarget(option),
      };
    });
  }, [isManagerMarketList, isMarketList, kind, managerMarketsQuery.data, marketsQuery.data, receive.options, t]);

  const searching = query.trim() !== "";
  // «Berilishi kerak» (Spt8Cj7m): 0 qoldiqli market sukut bo'yicha chiqmaydi, qidirilsa topiladi — kassasi ochiladi.
  // Menejer (PR-C): «To'lash mumkin» 0 bo'lgan market ham ko'rinadi (xira, tanlanmaydi).
  const hideZero = isMarketList && !isManagerMarketList;
  const visible = useMemo(
    () => rows.filter((row) => (searching ? matchesQuery(row, query) : !hideZero || row.amount !== 0)),
    [hideZero, query, rows, searching],
  );
  // Guruhlar tartibi: avval filiallar, so'ng HQ kuryerlari; har guruh ichida — summa bo'yicha kamayish.
  const ordered = useMemo(
    () =>
      kind === "receive"
        ? [
            ...byAmountDesc(visible.filter((row) => row.group === "branches")),
            ...byAmountDesc(visible.filter((row) => row.group === "hqCouriers")),
          ]
        : byAmountDesc(visible),
    [kind, visible],
  );

  const isLoading = isManagerMarketList
    ? managerMarketsQuery.isLoading
    : isMarketList
      ? marketsQuery.isLoading
      : receive.isLoading;
  const isError = isManagerMarketList
    ? managerMarketsQuery.isError
    : isMarketList
      ? Boolean(marketsQuery.isError)
      : receive.isError;
  const retry = () => {
    if (isManagerMarketList) void managerMarketsQuery.refetch();
    else if (isMarketList) void marketsQuery.refetch?.();
    else receive.refetch();
  };

  const selectedRow = ordered.find((row) => row.key === selectedKey && !row.disabled) ?? null;
  const selectedIndex = selectedRow ? ordered.indexOf(selectedRow) : -1;
  const optionId = (key: string) => `${listId}-option-${encodeURIComponent(key)}`;

  // Bir ochilishda `onSelect` faqat bir marta (ikki marta bosish, Enter takrori, yopilish harakati paytidagi
  // «Tanlash» — ikkinchi navigatsiya bo'lmasin). Har yangi ochilishda qulf yechiladi.
  const chosenRef = useRef(false);
  useEffect(() => {
    if (open) chosenRef.current = false;
  }, [open]);

  const choose = (row: PickerRow | null) => {
    if (!row || row.disabled || chosenRef.current) return;
    chosenRef.current = true;
    onSelect(row.target);
  };

  /** `index` dan `step` yo'nalishida birinchi tanlanadigan qator (tanlab bo'lmaydiganlari o'tkazib yuboriladi). */
  const moveTo = (index: number, step: 1 | -1) => {
    const count = ordered.length;
    for (let offset = 0; offset < count; offset += 1) {
      const next = ordered[(((index + offset * step) % count) + count) % count];
      if (next.disabled) continue;
      setSelectedKey(next.key);
      document.getElementById(optionId(next.key))?.scrollIntoView?.({ block: "nearest" });
      return;
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveTo(selectedIndex < 0 ? 0 : selectedIndex + 1, 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveTo(selectedIndex < 0 ? ordered.length - 1 : selectedIndex - 1, -1);
        break;
      case "Home":
      case "End":
        if (ordered.length === 0) return;
        event.preventDefault();
        if (event.key === "Home") moveTo(0, 1);
        else moveTo(ordered.length - 1, -1);
        break;
      case "Enter":
        event.preventDefault();
        choose(selectedRow);
        break;
      default:
        break;
    }
  };

  const reset = () => {
    setQuery("");
    setSelectedKey(null);
  };

  // ─── Sarlavha izohi: «… · jami X» ────────────────────────────────────────────
  const positiveSum = rows.reduce((sum, row) => (row.amount > 0 ? sum + row.amount : sum), 0);
  const totalAmount = total ?? positiveSum;
  const hasRows = !isLoading && !isError;
  let description: ReactNode;
  if (kind === "receive") {
    description = (
      <>
        <span>{t("selectReceiveSourceDescription")}</span>
        {total !== undefined || hasRows ? (
          <>
            {" · "}
            <span className="whitespace-nowrap">{t("v2Picker.total", { amount: money(totalAmount) })}</span>
          </>
        ) : null}
      </>
    );
  } else if (kind === "give") {
    const positiveCount = rows.filter((row) => row.amount > 0).length;
    // Menejer: jami — server `total_payable` («To'lash mumkin» yig'indisi), bo'lmasa qatorlardan.
    const payableTotal = managerMarketsQuery.data?.totalPayable ?? positiveSum;
    description = (
      <>
        <span>{t("v2Picker.give.description")}</span>
        {hasRows && (!isManagerMarketList || rows.length > 0) ? (
          <>
            {" · "}
            <span>
              {isManagerMarketList
                ? withNowrapAmount(
                    t("v2Picker.give.payableSummary", { count: positiveCount, amount: money(payableTotal) }),
                    money(payableTotal),
                  )
                : t("v2Picker.give.summary", { count: positiveCount, amount: money(positiveSum) })}
            </span>
          </>
        ) : null}
      </>
    );
  } else {
    description =
      total !== undefined || hasRows
        ? t("v2Picker.courier.description", { amount: money(totalAmount) })
        : t("v2Picker.courier.descriptionShort");
  }

  const copy = {
    receive: {
      title: t("v2Picker.receive.title"),
      placeholder: t("v2Picker.receive.searchPlaceholder"),
      searchLabel: t("v2Picker.receive.searchLabel"),
      listLabel: t("v2Picker.receive.listLabel"),
    },
    give: {
      title: t("v2Picker.give.title"),
      placeholder: t("v2Picker.give.searchPlaceholder"),
      searchLabel: t("v2Picker.give.searchLabel"),
      listLabel: t("v2Picker.give.listLabel"),
    },
    courier: {
      title: t("v2Picker.courier.title"),
      placeholder: t("v2Picker.courier.searchPlaceholder"),
      searchLabel: t("v2Picker.courier.searchLabel"),
      listLabel: branchName
        ? t("v2Picker.courier.group", { branch: branchName, count: ordered.length })
        : t("v2Picker.courier.listLabel"),
    },
  }[kind];

  const groupLabel = (row: PickerRow, index: number): string | null => {
    if (kind === "courier") {
      if (index !== 0) return null;
      const count = formatNumberLocalized(ordered.length, { language });
      return branchName
        ? t("v2Picker.courier.group", { branch: branchName, count })
        : t("v2Picker.courier.groupFallback", { count });
    }
    if (kind !== "receive" || !row.group) return null;
    const previous = ordered[index - 1];
    if (previous && previous.group === row.group) return null;
    return t(row.group === "branches" ? "v2Picker.receive.branches" : "v2Picker.receive.hqCouriers");
  };

  // Holatlar ro'yxatdan tashqarida (`listbox` ichida faqat variantlar bo'ladi).
  let stateContent: ReactNode = null;
  if (isLoading) {
    stateContent = (
      <div role="status" aria-label={t("v2Picker.loading")} className="py-2">
        <SkeletonList rows={5} />
      </div>
    );
  } else if (isError && isManagerMarketList) {
    // 503 — filial ulushini tekshirib bo'lmadi: bo'sh ro'yxat EMAS, backend sababi + «Qayta urinish».
    stateContent = (
      <ErrorState
        title={t("v2Picker.loadError")}
        error={managerMarketsQuery.error}
        description={shareCheckMessage(managerMarketsQuery.error)}
        onRetry={retry}
        retrying={managerMarketsQuery.isFetching}
      />
    );
  } else if (isError) {
    stateContent = <ErrorState title={t("v2Picker.loadError")} onRetry={retry} />;
  } else if (isManagerMarketList && rows.length === 0) {
    stateContent = <EmptyState icon={Store} title={t("v2Picker.give.managerEmpty")} />;
  } else if (rows.length === 0 || (ordered.length === 0 && !searching)) {
    stateContent = <EmptyState icon={Wallet} title={t("v2Picker.empty")} />;
  } else if (ordered.length === 0) {
    stateContent = <EmptyState icon={SearchX} title={t("v2Picker.noResults")} />;
  }

  let listContent: ReactNode = null;
  if (!stateContent) {
    listContent = ordered.map((row, index) => {
      const isSelected = row.key === selectedKey && !row.disabled;
      const label = groupLabel(row, index);
      const Icon = row.icon;
      return (
        <div key={row.key} role="presentation" className="flex flex-col">
          {label ? (
            <div
              role="presentation"
              className={cx("px-3 pb-1 text-xs font-semibold text-text-muted", index === 0 ? "pt-2.5" : "pt-3.5")}
            >
              {label}
            </div>
          ) : null}
          <div
            id={optionId(row.key)}
            role="option"
            aria-selected={isSelected}
            aria-disabled={row.disabled || undefined}
            data-key={row.key}
            onClick={() => {
              if (!row.disabled) setSelectedKey(row.key);
            }}
            onDoubleClick={() => choose(row)}
            className={cx(ROW, row.disabled ? DISABLED_ROW : isSelected ? "bg-action-soft" : "hover:bg-sunken")}
          >
            <span
              aria-hidden="true"
              className={cx(
                "inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                isSelected
                  ? "bg-action text-on-solid"
                  : row.disabled
                    ? "border-2 border-border"
                    : "border-2 border-border-strong",
              )}
            >
              {isSelected ? <Check size={12} strokeWidth={3} /> : null}
            </span>
            <span
              aria-hidden="true"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted max-md:hidden"
            >
              <Icon size={18} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className={cx("min-w-0 font-semibold", row.disabled ? "text-text-subtle" : "text-text")}>
                  {row.name}
                </span>
                {row.inactive ? <InactiveBadge isSelected={isSelected} /> : null}
              </span>
              {row.subtitle ? <span className="text-xs text-text-muted">{row.subtitle}</span> : null}
            </span>
            <span
              className={cx(
                "shrink-0 whitespace-nowrap font-semibold",
                row.amount < 0 ? "text-danger-fg" : row.disabled ? "text-text-subtle" : "text-text",
              )}
            >
              {money(row.amount)}
            </span>
          </div>
        </div>
      );
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onExited={reset}
      size="lg"
      icon={KIND_ICON[kind]}
      title={copy.title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("v2Picker.cancel")}
          </Button>
          <Button disabled={!selectedRow} onClick={() => choose(selectedRow)}>
            {t("v2Picker.select")}
          </Button>
        </>
      }
    >
      <TextInput
        mode="search"
        value={query}
        onValueChange={setQuery}
        placeholder={copy.placeholder}
        aria-label={copy.searchLabel}
        role="combobox"
        aria-expanded={listContent != null}
        aria-controls={listContent != null ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={selectedRow && listContent != null ? optionId(selectedRow.key) : undefined}
        autoComplete="off"
        onKeyDown={handleKeyDown}
      />
      <div className="flex min-h-0 flex-col border-t border-border pt-2">
        {stateContent ?? (
          <div
            id={listId}
            role="listbox"
            aria-label={copy.listLabel}
            // Bosilganda fokus qidiruv maydonida qoladi (`aria-activedescendant`).
            onMouseDown={(event) => event.preventDefault()}
            className="-mx-1 flex min-h-0 flex-col gap-0.5 md:max-h-[360px] md:overflow-y-auto md:overscroll-contain"
          >
            {listContent}
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default memo(SettlementPickerDialog);
