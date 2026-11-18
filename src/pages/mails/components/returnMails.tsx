// dizayn-v2: superadmin-mails-return, admin-mails-return, manager-mails-return, registrator-mails-return
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Building2, Check, RotateCcw, Truck, X } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { useDispatchBranchNames } from "../../../entities/branch";
import { useMails, type MailItem } from "../../../entities/mails";
import { cx } from "../../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { notify } from "../../../shared/lib/notify";
import { SelectionRegion } from "../../../shared/ui/SelectionRegion";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  QueryBoundary,
  SkeletonTable,
  useConfirm,
} from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import type { MailsTabLayout } from "../model/mailsLayout";
import {
  buildReturnPayload,
  getRequestId,
  groupReturnRequests,
  isBranchTransfer,
  parseReturnActionResult,
  returnActionErrorKey,
  returnRequestState,
  type ReturnAction,
  type ReturnActionResult,
  type ReturnGroup,
} from "../model/returnRequests";
import { ApproveReturnSummary } from "./ApproveReturnSummary";

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
 *
 * Filial o'tkazmasi so'rovlari (HQ doirasi; manzil filial menejeri «kelmagan» degan yoki qisman qabulda qolgan —
 * kuryersiz, ega qarori 2026-11-04) — har manzil filial alohida guruh: «Filial: <nomi> — kelmagan», `Building2`
 * belgisi, holat chipi «Filialga kelmagan»; xulosada kuryer sifatida sanalmaydi. Nomi — `dispatch-destinations`
 * dan (superadmin/admin/HQ registratori), olinmasa — «Filial o'tkazmasi — kelmagan».
 *
 * «Tasdiqlash» va «Rad etish» — faqat tasdiq oynasi orqali (u5HTJtqK; maket `superadmin-ops-logistics-approve-dialog`,
 * Ops'dagi «Qaytarish so'rovlari» nusxasidan ko'chgan — u o'chirildi, `/logistics-ops` va `/ops?tab=logistics` shu
 * tabga olib keladi): buyurtma va kuryer soni, kuryer bo'yicha guruhlar, HQ yoki filial ombori; so'rov oynaning
 * ichida ketadi, xato (403 / 409 «tanlov eskirgan» / 5xx) oynada qoladi — tanlov saqlanadi. Natija — xabar: hammasi
 * bajarilsa muvaffaqiyat, o'tkazib yuborilgan bo'lsa ogohlantirish va buyurtma raqamlari (birinchi 3 tasi, qolgani
 * «va yana N ta»). Rad etish — o'sha oyna, `danger` tonda (buyurtmalar omborga qaytmaydi).
 */

/** Filial nomlari (`GET /branches/dispatch-destinations`) faqat shu rollarga ochiq — qolganlar so'ramaydi. */
const BRANCH_NAME_ROLES = new Set(["superadmin", "admin", "registrator"]);

type Translate = (key: string, options?: Record<string, unknown>) => string;

// Tasdiqlangan buyurtma qayerga qaytadi: filial doirasida — o'sha filial
// omboriga, HQ doirasida — markazga. (Ilgari "branch" ham "Markazga" deb
// chiqardi.) «Marketga» manzili yo'q: backend doirasi faqat HQ/BRANCH, tasdiq buyurtmani o'z omboriga qaytaradi.
const isBranchDestination = (value: string | undefined) => {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("main") || normalized.includes("center") || normalized.includes("hq")) return false;
  return normalized.includes("branch");
};

const actionLabel = (value: string | undefined, t: Translate) =>
  t(isBranchDestination(value) ? "returnDestinationBranch" : "returnDestinationCenter");

const STATE_LABEL_KEYS = {
  notReceived: "returnStateNotReceived",
  withCourier: "returnStateWithCourier",
  notArrived: "returnStateNotArrived",
} as const;

/** Natija xabarida nomi bilan sanaladigan o'tkazib yuborilgan buyurtmalar (qolgani — «va yana N ta»). */
const SKIPPED_LISTED = 3;

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
  const confirm = useConfirm();
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
  // Filial o'tkazmasi guruhining nomi: backend bersa — o'sha, aks holda `dispatch-destinations` dan (ruxsatli rol).
  const role = useSelector((state: RootState) => state.role.role);
  const needsBranchNames = useMemo(
    () => requests.some((item) => isBranchTransfer(item) && !item.return_branch?.name && item.return_branch?.id),
    [requests],
  );
  const branchNames = useDispatchBranchNames(needsBranchNames && BRANCH_NAME_ROLES.has(String(role ?? "")));
  const branchLabel = useCallback(
    (branch: MailItem["return_branch"]) => {
      const name = branch?.name || (branch?.id ? branchNames.get(branch.id) : "") || "";
      return name ? t("returnBranchGroup", { branch: name }) : t("returnBranchGroupFallback");
    },
    [branchNames, t],
  );
  const groups = useMemo(
    () => groupReturnRequests(requests, t("courierFallback"), branchLabel),
    [requests, t, branchLabel],
  );
  const courierGroups = groups.filter((group) => group.kind === "courier").length;
  const branchGroups = groups.length - courierGroups;
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

  /** So'rov holati yorlig'i — jadval badge'i va tasdiq oynasi uchun bitta matn (noma'lum holat — «—»). */
  const stateLabel = (item: MailItem) => {
    const state = returnRequestState(item);
    return state ? t(STATE_LABEL_KEYS[state.key]) : "—";
  };

  /** «№1, №2, №3 ni …» — o'tkazib yuborilganlar sababi (tasdiqlash va rad etish natijasida bir xil). */
  const skippedReason = (skippedOrderIds: string[]) => {
    const listed = skippedOrderIds
      .slice(0, SKIPPED_LISTED)
      .map((id) => t("mailsArchive:return.dialog.orderNumber", { id }))
      .join(", ");
    const rest = skippedOrderIds.length - SKIPPED_LISTED;
    // Son bo'yicha alohida kalit: uz «… va yana 2 tasini», ru/en — birlik/ko'plik (plural qo'shimchasiz).
    return rest > 0
      ? t("mailsArchive:return.result.skippedReasonMore", { list: listed, value: count(rest) })
      : skippedOrderIds.length === 1
        ? t("mailsArchive:return.result.skippedReason", { orders: listed })
        : t("mailsArchive:return.result.skippedReasonMany", { orders: listed });
  };

  /** Natija — xabar (maket `superadmin-ops-logistics-approve-result`, ega S5): o'tkazib yuborilgan bo'lsa ogohlantirish. */
  const notifyResult = (type: ReturnAction, { done, skippedOrderIds }: ReturnActionResult) => {
    const outcome =
      type === "approve"
        ? t("mailsArchive:return.approve.result.returned", { value: count(done) })
        : t("mailsArchive:return.reject.result.kept");
    if (skippedOrderIds.length === 0) {
      notify.success(t(`mailsArchive:return.${type}.result.successTitle`, { value: count(done) }), {
        description: outcome,
      });
      return;
    }
    const reason = skippedReason(skippedOrderIds);
    notify.warning(
      t(`mailsArchive:return.${type}.result.partialTitle`, {
        done: count(done),
        skipped: count(skippedOrderIds.length),
      }),
      // Hech biri bajarilmagan bo'lsa «0 ta buyurtma omborga qaytarildi» yozilmaydi.
      { description: done > 0 ? `${outcome} ${reason}` : reason },
    );
  };

  /**
   * Tasdiqlash / rad etish — avval tasdiq oynasi (maket `superadmin-ops-logistics-approve-dialog`; rad etish — o'sha
   * naqsh, `danger`). So'rov oynaning ichida ketadi (yuklanish, xato — oynada; xom backend matni emas), muvaffaqiyatdan
   * keyin tanlov tozalanadi va natija xabari chiqadi. Xatoda yoki «Bekor qilish» da tanlov saqlanadi. Ro'yxatlar
   * (qaytarish, eski, yangi pochta, buyurtmalar) mutatsiyaning `onSettled` ida yangilanadi — xatoda ham.
   */
  const submit = async (type: ReturnAction) => {
    if (!selectedItems.length || isMutating) return;

    const payload = buildReturnPayload(selectedItems);
    const orderIds = [...payload.order_ids];
    const total = orderIds.length;
    const mutation = type === "approve" ? approveReturnRequests : rejectReturnRequests;
    // Ombor — ro'yxat doirasidan (`scope.type` → `action`): filial yoki HQ.
    const scopeKey = selectedItems.every((item) => isBranchDestination(item.action)) ? "branch" : "hq";
    // Natija `onConfirm` ichida yoziladi (oyna yopilgach o'qiladi).
    const outcome: { result: ReturnActionResult | null } = { result: null };

    const confirmed = await confirm({
      title: t(`mailsArchive:return.${type}.title`),
      description:
        type === "approve"
          ? t(`mailsArchive:return.approve.description.${scopeKey}`, { value: count(total) })
          : t("mailsArchive:return.reject.description", { value: count(total) }),
      icon: type === "approve" ? RotateCcw : X,
      tone: type === "approve" ? undefined : "danger",
      size: "md",
      closable: true,
      confirmLabel: t(`mailsArchive:return.${type}.confirm`, { value: count(total) }),
      confirmIcon: type === "approve" ? Check : X,
      loadingLabel: t(`mailsArchive:return.${type}.loading`),
      children: (
        <ApproveReturnSummary
          groups={groupReturnRequests(selectedItems, t("courierFallback"), branchLabel)}
          stateLabel={stateLabel}
        />
      ),
      errorMessage: (error) => t(`mailsArchive:return.${type}.errors.${returnActionErrorKey(error)}`),
      onConfirm: async () => {
        const response = await mutation.mutateAsync({ order_ids: orderIds });
        outcome.result = parseReturnActionResult(response, type, orderIds);
      },
    });
    if (!confirmed || !outcome.result) return;
    setSelectedIds(new Set());
    notifyResult(type, outcome.result);
  };

  /* ─── Qismlar ───────────────────────────────────────────────────────────── */

  const customerOf = (item: MailItem) =>
    item.customer?.name || t("customerNumber", { id: item.customer?.id || item.order_id || item.id });
  const phoneOf = (item: MailItem) => {
    const raw = item.customer?.phone_number || item.customer?.extra_number;
    return raw ? formatPhone(raw) : t("phoneUnavailable");
  };
  const stateBadge = (item: MailItem) => {
    const state = returnRequestState(item);
    return state ? (
      <Badge tone={state.tone} dot>
        {t(STATE_LABEL_KEYS[state.key])}
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
        label={t("mailsArchive:return.selectGroup", { courier: group.name })}
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
            i18nKey={branchGroups > 0 ? "mailsArchive:return.summaryWithBranches" : "mailsArchive:return.summary"}
            values={{ couriers: count(courierGroups), branches: count(branchGroups), orders: count(totalOrders) }}
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
            onClick={() => void submit("reject")}
            className="max-md:flex-1"
          >
            {t("returnReject")}
          </Button>
          <Button
            size="sm"
            leftIcon={Check}
            disabled={!someSelected || (isMutating && !approveReturnRequests.isPending)}
            loading={approveReturnRequests.isPending}
            onClick={() => void submit("approve")}
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
      group.phone ? formatPhone(group.phone) : null,
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
          <tbody key={group.key}>
            <tr>
              <td className={cx(TD, CHECK_CELL, "bg-sunken")}>{groupCheckbox(group)}</td>
              <td colSpan={3} className={cx(TD, "bg-sunken")}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-muted">
                    {group.kind === "branch" ? (
                      <Building2 aria-hidden="true" size={16} strokeWidth={2} />
                    ) : (
                      <Truck aria-hidden="true" size={16} strokeWidth={2} />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold text-text">{group.name}</span>
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
        <Fragment key={group.key}>
          <div
            role="listitem"
            className="flex items-center gap-1 border-y border-border bg-sunken py-2.5 pl-1 pr-4 first:border-t-0"
          >
            <label className="flex size-11 shrink-0 items-center justify-center">{groupCheckbox(group)}</label>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold text-text">{group.name}</span>
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
