// dizayn-v2: superadmin-mails-return, admin-mails-return, manager-mails-return, registrator-mails-return
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, RotateCcw, Truck, X } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useMails, type MailItem, type ReturnRequestActionPayload } from "../../../entities/mails";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import { cx } from "../../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { SelectionRegion } from "../../../shared/ui/SelectionRegion";
import { Badge, Button, Card, EmptyState, ErrorState, QueryBoundary, SkeletonTable } from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import type { MailsTabLayout } from "../model/mailsLayout";

/**
 * «Pochta → Qaytarish» — kuryerlarning qaytarish so'rovlari (maket `superadmin-mails-return`; admin, menejer va
 * registrator shu tuzilmada). Kuryerda bu tab yo'q (qobiq `/mails/today` ga qaytaradi).
 *
 * Tuzilma (shell kartasi ichida, `layout="card"`): xulosa («Jami qaytarish so'rovlari» · N ta kuryer, N ta
 * buyurtma) → tanlov paneli (doim ko'rinadi; 0 ta — `idle`, tugmalar o'chiq; ega qarori D10 — har guruhdagi
 * tugmalar o'rniga bitta panel) → kuryer bo'yicha guruhlangan jadval (guruh qatori `colspan` bilan, shuning uchun
 * `DataTable` emas — CODE-MAP 2.6 TH/TD retsepti), telefonda — guruh sarlavhasi + `label` kartalar.
 *
 * Backend sahifalamaydi — doiradagi barcha so'rovlar bir yo'la keladi (sahifalash yo'q).
 */

type ReturnGroup = {
  courierId: string;
  courierName: string;
  courierPhone: string;
  orders: MailItem[];
  totalAmount: number;
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

// Tasdiqlangan buyurtma qayerga qaytadi: filial doirasida — o'sha filial
// omboriga, HQ doirasida — markazga. (Ilgari "branch" ham "Markazga" deb
// chiqardi.) «Marketga» manzili yo'q: backend doirasi faqat HQ/BRANCH, tasdiq buyurtmani o'z omboriga qaytaradi.
const actionLabel = (value: string | undefined, t: Translate) => {
  const normalized = String(value ?? "").toLowerCase();

  if (normalized.includes("main") || normalized.includes("center") || normalized.includes("hq")) {
    return t("returnDestinationCenter");
  }

  if (normalized.includes("branch")) {
    return t("returnDestinationBranch");
  }

  return t("returnDestinationCenter");
};

// ON_THE_ROAD — kuryer pochtani qabul qilganda bu posilkani qabul qilmagan (warning);
// WAITING — eski oqimdagi so'rov, posilka kuryer qo'lida (neutral).
const requestState = (status: string | undefined, t: Translate) => {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "on the road") return { label: t("returnStateNotReceived"), tone: "warning" as const };
  if (normalized === "waiting") return { label: t("returnStateWithCourier"), tone: "neutral" as const };
  return null;
};

const getRequestId = (item: MailItem) =>
  item.request_id || item.order_id || item.id;

// Backend faqat { order_ids } qabul qiladi (ValidationPipe boshqa kalitni
// 400 bilan qaytaradi).
const buildReturnPayload = (items: MailItem[]): ReturnRequestActionPayload => ({
  order_ids: Array.from(
    new Set(items.map((item) => item.order_id || item.request_id || item.id).filter(Boolean)),
  ),
});

// Approve/reject javobi: { statusCode, message, data: { approved | rejected,
// order_ids, skipped_order_ids } }. Eskirgan tanlovni (kuryer shu orada qabul
// qilgan, hamkasb rad etgan) backend o'tkazib yuboradi va skipped da qaytaradi.
type ReturnActionResponse = {
  data?: {
    approved?: unknown;
    rejected?: unknown;
    skipped_order_ids?: unknown;
  } | null;
};

const groupByCourier = (items: MailItem[], courierFallback: string): ReturnGroup[] => {
  const groups = new Map<string, ReturnGroup>();

  items.forEach((item) => {
    const courierId = item.courier?.id || item.courier_id || "unknown";
    const courierName = item.courier?.name || courierFallback;
    const group = groups.get(courierId) ?? {
      courierId,
      courierName,
      courierPhone: item.courier?.phone_number || "",
      orders: [],
      totalAmount: 0,
    };

    group.orders.push(item);
    group.totalAmount += item.post_total_price;
    groups.set(courierId, group);
  });

  return Array.from(groups.values());
};

/* ─── Klasslar (CODE-MAP 2.6) ─────────────────────────────────────────────── */

const TH =
  "h-10 whitespace-nowrap border-b border-border bg-sunken px-4 text-left text-xs font-semibold uppercase " +
  "tracking-[.04em] text-text-muted";
const TD = "h-14 border-b border-border px-4 py-2 align-middle text-text";
/** `.el-col-check`: `w-11 pr-0`. */
const CHECK_CELL = "w-11 pr-0";
const CHECKBOX = "size-[18px] cursor-pointer accent-action disabled:cursor-not-allowed disabled:opacity-45";
const SUB = "text-[13px] text-text-muted";

/** Belgi: guruh/hammasi uchun qisman tanlov (`indeterminate` — faqat DOM xossasi). */
const Checkbox = ({
  checked,
  indeterminate = false,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className={CHECKBOX}
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={onChange}
    />
  );
};

type ReturnMailsProps = {
  /** Qobiq kartasi ichida (`card`, sukut) yoki o'z kartasi bilan (`page`). Qaytarish tabi faqat xodimlarda. */
  layout?: MailsTabLayout;
};

const ReturnMails = ({ layout = "card" }: ReturnMailsProps) => {
  const { t, i18n } = useTranslation(["mails", "mailsArchive"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isPhone = useIsPhone();
  const { apiRequest } = useAppNotification();
  const {
    useGetReturnMails,
    approveReturnRequests,
    rejectReturnRequests,
  } = useMails();
  // Backend sahifalamaydi — doiradagi barcha so'rovlar bir yo'la keladi.
  const query = useGetReturnMails();
  const response = query.data;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const requests: MailItem[] = useMemo(() => response?.data?.data ?? [], [response]);
  const groups = useMemo(() => groupByCourier(requests, t("courierFallback")), [requests, t]);
  const selectedItems = useMemo(
    () => requests.filter((item) => selectedIds.has(getRequestId(item))),
    [requests, selectedIds],
  );
  const isMutating = approveReturnRequests.isPending || rejectReturnRequests.isPending;
  const totalOrders = requests.reduce((sum, item) => sum + Math.max(1, item.order_quantity || 1), 0);
  const allIds = useMemo(() => requests.map(getRequestId), [requests]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = selectedItems.length > 0;

  const money = useCallback((value: unknown) => formatMoneyLocalized(value, { language }), [language]);
  const count = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleGroup = (group: ReturnGroup) => {
    const ids = group.orders.map(getRequestId);
    const groupSelected = ids.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (groupSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  };

  const submit = async (type: "approve" | "reject") => {
    if (!selectedItems.length || isMutating) return;

    const payload = buildReturnPayload(selectedItems);
    const mutation = type === "approve" ? approveReturnRequests : rejectReturnRequests;
    // Backend xabari (masalan "Siz faqat o'z filialingiz ...") ustun turadi.
    await apiRequest({
      request: () => mutation.mutateAsync(payload),
      // Son — backend haqiqatda bajargani (tanlanganlar soni emas); javobda son
      // bo'lmasa — tanlanganlar soni.
      successMessage: (res: unknown) => {
        const body = (res as ReturnActionResponse | null | undefined)?.data;
        const done = Number(type === "approve" ? body?.approved : body?.rejected);
        const total = Number.isFinite(done) ? done : payload.order_ids.length;
        const skipped = Array.isArray(body?.skipped_order_ids) ? body.skipped_order_ids.length : 0;
        const base = t(type === "approve" ? "returnApproveSuccess" : "returnRejectSuccess", { count: total });
        return skipped > 0 ? `${base} · ${t("returnSkippedNote", { count: skipped })}` : base;
      },
      errorMessage: t("returnActionError"),
      // Muvaffaqiyatda tanlov tozalanadi; xatoda saqlanadi (qayta urinish uchun).
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  /* ─── Qismlar ───────────────────────────────────────────────────────────── */

  const customerOf = (item: MailItem) =>
    item.customer?.name || t("customerNumber", { id: item.customer?.id || item.order_id || item.id });
  const phoneOf = (item: MailItem) => {
    const raw = item.customer?.phone_number || item.customer?.extra_number;
    return raw ? formatPhone(raw) : t("phoneUnavailable");
  };
  const stateBadge = (item: MailItem) => {
    const state = requestState(item.status, t);
    return state ? (
      <Badge tone={state.tone} dot>
        {state.label}
      </Badge>
    ) : null;
  };
  const destinationBadge = (item: MailItem) => <Badge>{actionLabel(item.action, t)}</Badge>;
  const groupState = (group: ReturnGroup) => {
    const ids = group.orders.map(getRequestId);
    const selected = ids.filter((id) => selectedIds.has(id)).length;
    return { checked: selected === ids.length && ids.length > 0, indeterminate: selected > 0 && selected < ids.length };
  };
  const groupCheckbox = (group: ReturnGroup) => {
    const state = groupState(group);
    return (
      <Checkbox
        checked={state.checked}
        indeterminate={state.indeterminate}
        disabled={isMutating}
        label={t("mailsArchive:return.selectGroup", { courier: group.courierName })}
        onChange={() => toggleGroup(group)}
      />
    );
  };
  const rowCheckbox = (item: MailItem) => (
    <Checkbox
      checked={selectedIds.has(getRequestId(item))}
      disabled={isMutating}
      label={t("mailsArchive:return.selectRow", { customer: customerOf(item) })}
      onChange={() => toggleOne(getRequestId(item))}
    />
  );

  const summary = (
    <div className="flex items-center gap-3 px-5 py-4 max-md:px-4">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted">
        <RotateCcw aria-hidden="true" size={18} strokeWidth={2} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-sm font-semibold text-text">{t("returnRequestsTotal")}</h2>
        <p className={SUB}>
          <Trans
            t={t}
            i18nKey="mailsArchive:return.summary"
            values={{ couriers: count(groups.length), orders: count(totalOrders) }}
            components={{ strong: <span className="font-semibold text-text" /> }}
          />
        </p>
      </div>
    </div>
  );

  const selection = (
    <SelectionRegion
      label={t("mailsArchive:return.selectionLabel")}
      idle={!someSelected}
      title={
        someSelected
          ? t("mailsArchive:return.selected", { count: selectedItems.length, value: count(selectedItems.length) })
          : t("mailsArchive:return.noneSelected")
      }
      hint={t("mailsArchive:return.selectionHint")}
      action={
        <>
          <Button
            variant="ghost"
            size="sm"
            disabled={!someSelected || isMutating}
            onClick={() => setSelectedIds(new Set())}
            className="max-md:order-last max-md:basis-full"
          >
            {t("mailsArchive:return.clearSelection")}
          </Button>
          <Button
            variant="danger-soft"
            size="sm"
            leftIcon={X}
            disabled={!someSelected || (isMutating && !rejectReturnRequests.isPending)}
            loading={rejectReturnRequests.isPending}
            onClick={() => submit("reject")}
            className="max-md:flex-1"
          >
            {t("returnReject")}
          </Button>
          <Button
            size="sm"
            leftIcon={Check}
            disabled={!someSelected || (isMutating && !approveReturnRequests.isPending)}
            loading={approveReturnRequests.isPending}
            onClick={() => submit("approve")}
            className="max-md:flex-1"
          >
            {t("returnApprove")}
          </Button>
        </>
      }
    />
  );

  const groupSub = (group: ReturnGroup, short: boolean) =>
    [
      short
        ? t("mailsArchive:return.groupShort", { count: group.orders.length, value: count(group.orders.length) })
        : t("returnGroupDescription", { count: group.orders.length }),
      group.courierPhone ? formatPhone(group.courierPhone) : null,
    ]
      .filter(Boolean)
      .join(" · ");

  const table = (
    <div className="relative overflow-x-auto">
      <table
        aria-label={t("mailsArchive:return.tableLabel")}
        className="w-full border-collapse text-sm [&_tbody:last-child_tr:last-child_td]:border-b-0"
      >
        <thead>
          <tr>
            <th scope="col" className={cx(TH, CHECK_CELL)}>
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                disabled={isMutating}
                label={t("mailsArchive:return.selectAll")}
                onChange={toggleAll}
              />
            </th>
            <th scope="col" className={cx(TH, "w-[26%]")}>
              {t("mailsArchive:return.columns.customer")}
            </th>
            <th scope="col" className={cx(TH, "w-[24%]")}>
              {t("mailsArchive:return.columns.area")}
            </th>
            <th scope="col" className={TH}>
              {t("mailsArchive:return.columns.status")}
            </th>
            <th scope="col" className={cx(TH, "max-lg:hidden")}>
              {t("mailsArchive:return.columns.destination")}
            </th>
            <th scope="col" className={cx(TH, "text-right")}>
              {t("mailsArchive:return.columns.amount")}
            </th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.courierId}>
            <tr>
              <td className={cx(TD, CHECK_CELL, "bg-sunken")}>{groupCheckbox(group)}</td>
              <td colSpan={3} className={cx(TD, "bg-sunken")}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-muted">
                    <Truck aria-hidden="true" size={16} strokeWidth={2} />
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold text-text">{group.courierName}</span>
                    <span className={cx(SUB, "truncate")}>{groupSub(group, false)}</span>
                  </div>
                </div>
              </td>
              <td className={cx(TD, "bg-sunken max-lg:hidden")} />
              <td className={cx(TD, "whitespace-nowrap bg-sunken text-right font-semibold")}>
                {money(group.totalAmount)}
              </td>
            </tr>
            {group.orders.map((item) => {
              const id = getRequestId(item);
              const selected = selectedIds.has(id);
              return (
                <tr
                  key={id}
                  data-selected={selected || undefined}
                  className={selected ? "bg-action-soft" : "hover:bg-row-hover"}
                >
                  <td className={cx(TD, CHECK_CELL)}>{rowCheckbox(item)}</td>
                  <td className={TD}>
                    <div className="whitespace-nowrap font-semibold text-text">{customerOf(item)}</div>
                    <div className={cx(SUB, "whitespace-nowrap")}>{phoneOf(item)}</div>
                  </td>
                  <td className={TD}>
                    <div className="whitespace-nowrap">{item.district?.name || "—"}</div>
                    {item.region?.name ? <div className={SUB}>{item.region.name}</div> : null}
                  </td>
                  <td className={TD}>
                    <div className="flex flex-col items-start gap-1">
                      {stateBadge(item)}
                      <span className="hidden max-lg:inline-flex">{destinationBadge(item)}</span>
                    </div>
                  </td>
                  <td className={cx(TD, "max-lg:hidden")}>{destinationBadge(item)}</td>
                  <td className={cx(TD, "whitespace-nowrap text-right font-semibold")}>
                    {money(item.post_total_price)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );

  const cards = (
    <div role="list" aria-label={t("mailsArchive:return.tableLabel")} className="flex flex-col">
      {groups.map((group) => (
        <Fragment key={group.courierId}>
          <div
            role="listitem"
            className="flex items-center gap-1 border-y border-border bg-sunken py-2.5 pl-1 pr-4 first:border-t-0"
          >
            <label className="flex size-11 shrink-0 items-center justify-center">{groupCheckbox(group)}</label>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold text-text">{group.courierName}</span>
              <span className={SUB}>{groupSub(group, true)}</span>
            </span>
            <span className="whitespace-nowrap text-sm font-semibold text-text">{money(group.totalAmount)}</span>
          </div>
          {group.orders.map((item) => {
            const id = getRequestId(item);
            const selected = selectedIds.has(id);
            const area = [item.district?.name, item.region?.name].filter(Boolean).join(", ");
            return (
              <label
                key={id}
                role="listitem"
                data-selected={selected || undefined}
                className={cx(
                  "flex cursor-pointer items-start gap-1 border-b border-border py-3 pl-1 pr-4 last:border-b-0",
                  selected && "bg-action-soft",
                )}
              >
                <span className="-mt-2.5 flex size-11 shrink-0 items-center justify-center">{rowCheckbox(item)}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex justify-between gap-2">
                    <span className="min-w-0 truncate font-semibold text-text">{customerOf(item)}</span>
                    <span className="whitespace-nowrap text-sm font-semibold text-text">{money(item.post_total_price)}</span>
                  </span>
                  <span className={SUB}>{[phoneOf(item), area].filter(Boolean).join(" · ")}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {stateBadge(item)}
                    {destinationBadge(item)}
                  </span>
                </span>
              </label>
            );
          })}
        </Fragment>
      ))}
    </div>
  );

  const body: ReactNode = (
    <QueryBoundary
      query={query}
      isEmpty={(data) => (data?.data?.data ?? []).length === 0}
      loadingLabel={t("mailsArchive:return.loading")}
      error={(error, retry) => (
        <ErrorState error={error} title={t("mailsArchive:return.loadError")} onRetry={retry} />
      )}
      loading={
        <SkeletonTable
          framed={false}
          rows={5}
          columns={[
            t("mailsArchive:return.columns.customer"),
            t("mailsArchive:return.columns.area"),
            t("mailsArchive:return.columns.status"),
            t("mailsArchive:return.columns.destination"),
            t("mailsArchive:return.columns.amount"),
          ]}
        />
      }
      empty={
        <EmptyState
          icon={RotateCcw}
          title={t("returnEmptyTitle")}
          description={t("returnEmptyDescription")}
        />
      }
    >
      {summary}
      {selection}
      {isPhone ? cards : table}
    </QueryBoundary>
  );

  // Qobiq kartasi ichida — o'z kartasi yo'q; `page` — mustaqil karta.
  return layout === "page" ? <Card padding="none">{body}</Card> : body;
};

export default memo(ReturnMails);
