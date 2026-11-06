// dizayn-v2: (maket yo'q) superadmin-returns-list
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CircleCheck, CircleX, FileImage, Lock, Receipt, TimerReset, Unlink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link, useSearchParams } from "react-router-dom";
import type { RootState } from "../../app/config/store";
import { formatOrderRef } from "../../entities/order";
import { useOrders } from "../../entities/orders";
import { extraCostOrderNumber } from "../../entities/orders/extraCostApprovalView";
import { isExtraCostAlreadyDecidedError } from "../../entities/orders/extraCostDecision";
import {
  EXTRA_COST_TABS,
  useExtraCosts,
  type ExtraCostRow,
  type ExtraCostTab,
} from "../../entities/orders/extraCosts";
import { getActionErrorMessage } from "../../shared/lib/actionError";
import { formatDateTimeLocalized } from "../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../shared/lib/formatMoney";
import { formatPhone } from "../../shared/lib/formatPhone";
import { notify } from "../../shared/lib/notify";
import { scrollShellContentToTop, usePagination } from "../../shared/lib/usePagination";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  QueryBoundary,
  Skeleton,
  SkeletonTable,
  StatusBadge,
  Tabs,
  useConfirm,
  type DataTableColumn,
  type TabItem,
} from "../../shared/ui/primitives";
import { ExtraCostRejectDialog, type ExtraCostRejectPayload } from "../dashboard/ui/ExtraCostRejectDialog";
import {
  EXTRA_COST_DEFAULT_LIMIT,
  EXTRA_COST_PAGE_SIZES,
  EXTRA_COST_STATUS_META,
  canDecideExtraCosts,
  extraCostDecisionDate,
  extraCostEmptyKey,
  extraCostOrderHref,
  extraCostReasonText,
  extraCostStatusKind,
  extraCostTabLabelKey,
  readExtraCostTab,
  showsRequester,
  toExtraCostViewer,
  writeExtraCostTab,
} from "./model/extraCostsView";
import { ExtraCostProofDialog } from "./ui/ExtraCostProofDialog";

const LINK = "whitespace-nowrap font-semibold text-text hover:text-action-fg hover:underline";

/** Tasdiqlansa nima bo'ladi — market dashboardidagi tasdiq oynasi bilan bir xil matn (`dashboard` nomlar fazosi). */
const CONSEQUENCE_KEYS: Record<ExtraCostRow["action"], string> = {
  sell: "dashboard:market.extra_cost_on_approve_sell",
  partly_sell: "dashboard:market.extra_cost_on_approve_partly_sell",
  cancel: "dashboard:market.extra_cost_on_approve_cancel",
};

const REJECT_DIALOG_ACTION_KEYS: Record<ExtraCostRow["action"], string> = {
  sell: "dashboard:market.extra_cost_sell",
  partly_sell: "dashboard:market.extra_cost_partly_sell",
  cancel: "dashboard:market.extra_cost_cancel",
};

/**
 * QO'SHIMCHA XARAJATLI BUYURTMALAR — `/extra-costs` (GykuOz8f), dizayn v2.
 *
 * Kuryer yoki menejer sotish / bekor qilish / qisman sotishda qo'shimcha xarajat yozadi; market tasdig'i yoqilgan
 * bo'lsa so'rov marketga tushadi, o'chiq bo'lsa xarajat darhol yoziladi. Bu sahifa — shu xarajatlarning hammasi:
 * kim, qaysi buyurtmaga, qancha va nima uchun yozgani, market qarori va sababi, isbot rasmi / videosi.
 *
 * Kim ko'radi (doira backend'da, faqat tokendan — `GET orders/extra-costs`): kuryer — o'zi yozganlari; menejer — o'z
 * filiali kuryerlari va o'zi; market — o'z marketi («Tasdiqlash kutilayotgan» tabida «Tasdiqlash» — tasdiq oynasi
 * bilan, «Rad etish» — sabab oynasi); market operatori — o'z marketi, faqat ko'rish (marketga biriktirilmagan bo'lsa
 * so'rov yuborilmaydi). Admin va superadmin — sahifa yo'q (route 403).
 *
 * Tablar (sonlari javobdagi `counts` dan): Barchasi · Kutilmoqda (marketda «Tasdiqlash kutilayotgan») · Tasdiqlangan ·
 * Bekor qilingan. Tab va sahifa URL'da (`?tab&page&limit`) — bildirishnoma havolasi (`/extra-costs?tab=cancelled`)
 * kerakli tabni ochadi. Telefonda jadval o'rniga kartalar.
 *
 * Maket yo'q — eng yaqini `superadmin-returns-list` (sarlavha + jami, kartada tablar, jadval, sahifalash) va
 * `market-dashboard-extra-cost-approvals` (tasdiqlash / rad etish).
 */
const ExtraCostsPage = () => {
  const { t, i18n } = useTranslation(["extraCosts", "dashboard", "common"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const confirm = useConfirm();
  const role = useSelector((state: RootState) => state.role.role);
  const user = useSelector((state: RootState) => state.user.user);
  const viewer = toExtraCostViewer(role);
  const canDecide = canDecideExtraCosts(viewer);
  const withRequester = showsRequester(viewer);
  // Operator marketga biriktirilmagan (profil yuklangan, `market_id` yo'q) — backend 403 beradi, so'rov yuborilmaydi.
  const unassigned = viewer === "market_operator" && user != null && user.market_id == null;

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = readExtraCostTab(searchParams);
  const { page, limit, setPage, setLimit } = usePagination({
    key: "extraCosts",
    defaultLimit: EXTRA_COST_DEFAULT_LIMIT,
    allowedLimits: EXTRA_COST_PAGE_SIZES,
  });
  const params = useMemo(() => ({ tab, page, limit }), [limit, page, tab]);
  const query = useExtraCosts(params, !unassigned);
  const { data, isLoading, isPending, isFetching, isPaused, isError, error, refetch, isPlaceholderData } = query;

  // Sahifa ro'yxat oxiridan tashqarida qolsa (oxirgi sahifadagi yagona so'rov tasdiqlandi / rad etildi yoki eski
  // `?page=N` havolasi) — bo'sh holat va sahifalashsiz qolib ketmasin: oxirgi sahifaga o'tiladi (`/orders` dagidek).
  const listTotal = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(listTotal / limit));
  const pastEnd = Boolean(data && !isPlaceholderData && !isError && data.items.length === 0 && listTotal > 0);
  useEffect(() => {
    if (pastEnd && page > lastPage) setPage(lastPage);
  }, [lastPage, page, pastEnd, setPage]);

  const { approveExtraCostApproval, rejectExtraCostApproval } = useOrders();
  const [proof, setProof] = useState<{ row: ExtraCostRow; open: boolean } | null>(null);
  const [reject, setReject] = useState<{ row: ExtraCostRow; open: boolean } | null>(null);

  const changeTab = useCallback(
    (next: ExtraCostTab) => setSearchParams((prev) => writeExtraCostTab(prev, next), { replace: true }),
    [setSearchParams],
  );
  const changePage = useCallback(
    (next: number) => {
      setPage(next);
      scrollShellContentToTop();
    },
    [setPage],
  );

  // ─── Ko'rinish ───────────────────────────────────────────────────────────────
  const money = useCallback((value: number) => formatMoneyLocalized(value, { language }), [language]);
  const count = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);
  const dateTime = useCallback((value: string) => formatDateTimeLocalized(value, { language }), [language]);
  const refOf = (row: ExtraCostRow) => formatOrderRef({ id: row.order_id, order_number: row.order_number });

  const counts = data?.counts ?? null;
  const tabs: TabItem<ExtraCostTab>[] = EXTRA_COST_TABS.map((value) => ({
    value,
    label: t(extraCostTabLabelKey(value, viewer)),
    ...(counts ? { count: counts[value] } : {}),
  }));

  const statusBadge = (row: ExtraCostRow) => {
    const kind = extraCostStatusKind(row);
    const meta = EXTRA_COST_STATUS_META[kind];
    return <StatusBadge tone={meta.tone} icon={meta.icon} label={t(`status.${kind}`)} data-status={kind} />;
  };

  const autoHint = (row: ExtraCostRow) =>
    row.status === "pending" && row.auto_approve_at ? (
      <span
        data-testid={`extra-cost-auto-${row.id}`}
        className="flex items-center gap-1 text-[13px] font-semibold text-warning-fg"
      >
        <TimerReset size={14} className="flex-none" aria-hidden="true" />
        {t("autoAt", { time: dateTime(row.auto_approve_at) })}
      </span>
    ) : null;

  const reasonOf = (row: ExtraCostRow) =>
    extraCostReasonText(
      row,
      row.reject_reason ? t(`dashboard:market.extra_cost_reject_reasons.${row.reject_reason}`) : null,
    );

  const requesterOf = (row: ExtraCostRow) => {
    const name = row.requested_by?.name ?? t("requesterFallback", { id: row.requested_by_user_id });
    const requesterRole = row.requested_by_role ? String(row.requested_by_role).toLowerCase() : "";
    return {
      name,
      role: requesterRole ? t(`role.${requesterRole}`, { defaultValue: requesterRole }) : null,
    };
  };

  const decisionLine = (row: ExtraCostRow) => {
    const date = extraCostDecisionDate(row);
    if (!date) return null;
    return row.decided_at ? t("decidedAt", { date: dateTime(date) }) : t("closedAt", { date: dateTime(date) });
  };

  const customerOf = (row: ExtraCostRow) => ({
    name: row.customer?.name ?? t("unknownCustomer"),
    phone: row.customer?.phone ? formatPhone(row.customer.phone) : null,
  });

  // ─── Market qarori ───────────────────────────────────────────────────────────
  /** `true` — so'rov boshqa joyda hal qilingan (ro'yxat yangilandi), oyna yopilsin. */
  const handleDecisionError = (decisionError: unknown) => {
    if (isExtraCostAlreadyDecidedError(decisionError)) {
      void refetch();
      notify.info(t("dashboard:market.extra_cost_already_decided"), {
        description: t("dashboard:market.extra_cost_already_decided_hint"),
      });
      return true;
    }
    const description = getActionErrorMessage(decisionError, t("dashboard:market.extra_cost_action_error"));
    if (description) notify.error(t("common:error"), { description });
    return false;
  };

  const handleApprove = async (row: ExtraCostRow) => {
    const ok = await confirm({
      tone: "success",
      title: t("dashboard:market.extra_cost_confirm_title"),
      description: t("dashboard:market.extra_cost_confirm_description", { id: extraCostOrderNumber(row) }),
      amount: { value: row.amount, label: t("dashboard:market.extra_cost_requested_amount") },
      consequences: [{ text: t(CONSEQUENCE_KEYS[row.action]), tone: "warning" }],
      confirmLabel: t("approve"),
      confirmIcon: CircleCheck,
    });
    if (!ok) return;
    approveExtraCostApproval.mutate(
      { id: row.id },
      {
        onSuccess: () => notify.success(t("dashboard:market.extra_cost_approved"), { description: refOf(row) }),
        onError: handleDecisionError,
      },
    );
  };

  const closeReject = () => setReject((current) => (current ? { ...current, open: false } : current));

  const handleReject = (row: ExtraCostRow, payload: ExtraCostRejectPayload) => {
    rejectExtraCostApproval.mutate(
      { id: row.id, ...payload },
      {
        onSuccess: () => {
          closeReject();
          notify.success(t("dashboard:market.extra_cost_rejected"), { description: refOf(row) });
        },
        onError: (rejectError) => {
          if (handleDecisionError(rejectError)) closeReject();
        },
      },
    );
  };

  const approvingId = approveExtraCostApproval.isPending ? String(approveExtraCostApproval.variables?.id ?? "") : "";
  const rejectingId = rejectExtraCostApproval.isPending ? String(rejectExtraCostApproval.variables?.id ?? "") : "";
  // Tugmalar faqat «Tasdiqlash kutilayotgan» tabida va faqat market egasida (operator — faqat ko'rish).
  const showDecision = canDecide && tab === "pending";

  const proofButton = (row: ExtraCostRow, place: "table" | "card") =>
    row.proof_count > 0 ? (
      <Button
        variant="secondary"
        size="sm"
        compact={place === "table"}
        leftIcon={FileImage}
        aria-label={t("proofButtonLabel", { ref: refOf(row), count: row.proof_count })}
        onClick={() => setProof({ row, open: true })}
      >
        {t("proofButton", { count: row.proof_count })}
      </Button>
    ) : place === "table" ? (
      <span className="text-[13px] text-text-muted">{t("proofNone")}</span>
    ) : null;

  const decisionButtons = (row: ExtraCostRow) => {
    if (!showDecision || row.status !== "pending") return null;
    const busy = approvingId === row.id || rejectingId === row.id;
    const amountText = money(row.amount);
    return (
      <>
        <Button
          variant="success"
          size="sm"
          leftIcon={CircleCheck}
          loading={approvingId === row.id}
          loadingText={t("dashboard:market.extra_cost_approving")}
          disabled={busy && approvingId !== row.id}
          aria-label={t("approveLabel", { ref: refOf(row), amount: amountText })}
          onClick={() => void handleApprove(row)}
        >
          {t("approve")}
        </Button>
        <Button
          variant="danger-soft"
          size="sm"
          leftIcon={CircleX}
          loading={rejectingId === row.id}
          loadingText={t("dashboard:market.extra_cost_rejecting")}
          disabled={busy && rejectingId !== row.id}
          aria-label={t("rejectLabel", { ref: refOf(row), amount: amountText })}
          onClick={() => setReject({ row, open: true })}
        >
          {t("reject")}
        </Button>
      </>
    );
  };

  /** Kim yozgan — bir qatorda (planshet jadvali: «Kim yozgan» ustuni yashirin bo'lganda buyurtma katagida). */
  const requesterInline = (row: ExtraCostRow, className: string) => {
    const requester = requesterOf(row);
    return (
      <span className={`text-[13px] text-text-muted ${className}`}>
        {t("columns.requester")}: <span className="font-semibold text-text">{requester.name}</span>
        {requester.role ? ` · ${requester.role}` : null}
      </span>
    );
  };

  /** Sanalar va sabab — «Sana» / «Sabab» ustunlari yashirin bo'lganda (planshet) summa katagi ostida. */
  const secondaryDetails = (row: ExtraCostRow, className: string) => {
    const decision = decisionLine(row);
    const reason = reasonOf(row);
    return (
      <span className={`flex flex-col gap-0.5 text-[13px] ${className}`}>
        {row.createdAt ? <span className="text-text-muted">{t("requestedAt", { date: dateTime(row.createdAt) })}</span> : null}
        {decision ? <span className="text-text-muted">{decision}</span> : null}
        {reason ? <span className="text-text">{reason}</span> : null}
      </span>
    );
  };

  const columns: DataTableColumn<ExtraCostRow>[] = [
    {
      id: "order",
      header: t("columns.order"),
      cell: (row) => {
        const ref = refOf(row);
        return (
          <span className="flex min-w-0 flex-col gap-0.5">
            <Link to={extraCostOrderHref(row)} aria-label={t("openOrder", { ref })} className={LINK}>
              {ref}
            </Link>
            <span className="text-[13px] text-text-muted">{t(`action.${row.action}`)}</span>
            {withRequester ? requesterInline(row, "lg:hidden") : null}
          </span>
        );
      },
    },
    {
      id: "customer",
      header: t("columns.customer"),
      cell: (row) => {
        const customer = customerOf(row);
        return (
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-text">{customer.name}</span>
            {customer.phone ? (
              <span className="whitespace-nowrap text-[13px] text-text-muted tabular-nums">{customer.phone}</span>
            ) : null}
          </span>
        );
      },
    },
    {
      id: "amount",
      header: t("columns.amount"),
      cell: (row) => (
        <span className="flex flex-col items-start gap-1">
          <span className="whitespace-nowrap font-semibold text-text">{money(row.amount)}</span>
          {statusBadge(row)}
          {autoHint(row)}
          {/* Planshetda (768–1023) «Sana» va «Sabab» ustunlari yashirin — shu yerda (kartadagi 5-band har qatorda). */}
          {secondaryDetails(row, "lg:hidden")}
        </span>
      ),
    },
    ...(withRequester
      ? [
          {
            id: "requester",
            header: t("columns.requester"),
            hideBelow: "lg",
            cell: (row: ExtraCostRow) => {
              const requester = requesterOf(row);
              return (
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-text">{requester.name}</span>
                  {requester.role ? <span className="text-[13px] text-text-muted">{requester.role}</span> : null}
                </span>
              );
            },
          } satisfies DataTableColumn<ExtraCostRow>,
        ]
      : []),
    {
      id: "dates",
      header: t("columns.dates"),
      hideBelow: "lg",
      cell: (row) => {
        const decision = decisionLine(row);
        return (
          <span className="flex flex-col gap-0.5 text-[13px] text-text-muted">
            {row.createdAt ? <span>{t("requestedAt", { date: dateTime(row.createdAt) })}</span> : null}
            {decision ? <span>{decision}</span> : null}
          </span>
        );
      },
    },
    // «Kutilmoqda» tabida qaror hali yo'q — sabab ustuni doim «—» bo'lardi (jadval kengligi tejaladi).
    ...(tab === "pending"
      ? []
      : [
          {
            id: "reason",
            header: t("columns.reason"),
            hideBelow: "lg",
            cell: (row: ExtraCostRow) => <span className="text-[13px] text-text">{reasonOf(row) ?? "—"}</span>,
          } satisfies DataTableColumn<ExtraCostRow>,
        ]),
    {
      id: "proof",
      header: t("columns.proof"),
      cell: (row) => proofButton(row, "table"),
    },
    ...(showDecision
      ? [
          {
            id: "actions",
            header: t("columns.actions"),
            align: "end",
            cell: (row: ExtraCostRow) => (
              <span className="flex flex-wrap items-center justify-end gap-2">{decisionButtons(row)}</span>
            ),
          } satisfies DataTableColumn<ExtraCostRow>,
        ]
      : []),
  ];

  // Telefon kartasi: holat va summa, buyurtma (havola) · amal, mijoz, kim yozgan, sanalar, sabab, isbot va qaror tugmalari.
  const renderCard = (row: ExtraCostRow) => {
    const ref = refOf(row);
    const customer = customerOf(row);
    const decision = decisionLine(row);
    const reason = reasonOf(row);
    const proofAction = proofButton(row, "card");
    const decisionAction = decisionButtons(row);
    return (
      <div className="flex min-w-0 flex-col gap-2 px-4 py-3 text-sm text-text">
        <span className="flex items-start justify-between gap-2">
          {statusBadge(row)}
          <span className="whitespace-nowrap font-semibold">{money(row.amount)}</span>
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            to={extraCostOrderHref(row)}
            aria-label={t("openOrder", { ref })}
            className="-my-3 inline-flex min-h-11 items-center font-semibold text-action-fg hover:underline"
          >
            {ref}
          </Link>
          <span className="text-text-muted">· {t(`action.${row.action}`)}</span>
        </span>
        <span className="text-[13px] text-text-muted">
          {customer.name}
          {customer.phone ? (
            <>
              {" · "}
              <span className="whitespace-nowrap tabular-nums">{customer.phone}</span>
            </>
          ) : null}
        </span>
        {withRequester ? requesterInline(row, "") : null}
        <span className="text-[13px] text-text-muted">
          {[row.createdAt ? t("requestedAt", { date: dateTime(row.createdAt) }) : null, decision]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {autoHint(row)}
        {reason ? <span className="text-[13px] text-text">{reason}</span> : null}
        {proofAction || decisionAction ? (
          <span className="flex flex-col gap-2 pt-1">
            {/* Isbot — o'z qatorida (ru «Файлы (N)» ham to'liq sig'adi), qaror tugmalari — ikki ustunda. */}
            {proofAction ? <span className="grid">{proofAction}</span> : null}
            {decisionAction ? <span className="grid grid-cols-2 gap-2">{decisionAction}</span> : null}
          </span>
        ) : null}
      </div>
    );
  };

  // ─── Sarlavha ────────────────────────────────────────────────────────────────
  const total = counts?.all ?? (tab === "all" ? data?.total : undefined);
  const description: ReactNode = (
    <>
      {viewer ? t(`description.${viewer}`) : null}
      {total !== undefined ? (
        <>
          {" · "}
          <span className="whitespace-nowrap">{t("total", { count: total, value: count(total) })}</span>
        </>
      ) : isLoading ? (
        <>
          {" · "}
          <Skeleton width={96} height={14} className="inline-block align-middle" />
        </>
      ) : null}
    </>
  );

  if (unassigned) {
    return (
      <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
        <PageHeader title={t("title")} />
        <Card as="section" padding="none" data-testid="extra-costs-unassigned">
          <EmptyState icon={Unlink} title={t("unassigned.title")} description={t("unassigned.description")} />
        </Card>
      </div>
    );
  }

  const emptyKey = extraCostEmptyKey(tab, viewer);

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader title={t("title")} description={description} />

      <Card
        as="section"
        padding="none"
        aria-label={t("listLabel")}
        footer={
          data && data.total > 0 ? (
            <Pagination
              page={data.page || page}
              pageSize={data.limit || limit}
              total={data.total}
              onPageChange={changePage}
              onPageSizeChange={setLimit}
              pageSizeOptions={EXTRA_COST_PAGE_SIZES}
              summary={(range) => t("pagination", range)}
            />
          ) : undefined
        }
      >
        <Tabs
          items={tabs}
          value={tab}
          onValueChange={changeTab}
          ariaLabel={t("tabsLabel")}
          listClassName="px-3"
          countBusy={Boolean(isPlaceholderData && isFetching)}
        />

        {viewer === "market_operator" ? (
          <p className="flex items-center gap-1.5 px-5 pt-3 text-[13px] text-text-muted max-md:px-4">
            <Lock size={16} className="flex-none" aria-hidden="true" />
            {t("readOnlyHint")}
          </p>
        ) : null}

        <QueryBoundary
          query={{ data: data?.items, isLoading, isPending, isFetching, isPaused, isError, error, refetch }}
          isEmpty={(items) => items.length === 0}
          loadingLabel={t("loading")}
          loading={
            <SkeletonTable
              framed={false}
              columns={[t("columns.order"), t("columns.customer"), t("columns.amount"), t("columns.proof")]}
              rows={6}
            />
          }
          empty={
            <EmptyState
              icon={Receipt}
              title={t(`empty.${emptyKey}`)}
              description={t(`empty.${emptyKey}Description`)}
            />
          }
          error={(queryError, retry) => <ErrorState error={queryError} title={t("loadFailed")} onRetry={retry} />}
        >
          {(rows, { isRefetching }) => (
            <DataTable
              rows={rows}
              columns={columns}
              getRowKey={(row) => row.id}
              label={t("listLabel")}
              cardsLabel={t("cardsLabel")}
              density="tablet-tight"
              renderCard={renderCard}
              busy={isRefetching}
            />
          )}
        </QueryBoundary>
      </Card>

      {proof ? (
        <ExtraCostProofDialog
          key={proof.row.id}
          row={proof.row}
          open={proof.open}
          onClose={() => setProof((current) => (current ? { ...current, open: false } : current))}
          onExited={() => setProof((current) => (current?.open ? current : null))}
        />
      ) : null}
      {reject ? (
        <ExtraCostRejectDialog
          key={reject.row.id}
          approval={reject.row}
          actionLabel={t(REJECT_DIALOG_ACTION_KEYS[reject.row.action])}
          open={reject.open}
          pending={rejectExtraCostApproval.isPending}
          onClose={closeReject}
          onExited={() => setReject((current) => (current?.open ? current : null))}
          onSubmit={(payload) => handleReject(reject.row, payload)}
        />
      ) : null}
    </div>
  );
};

export default memo(ExtraCostsPage);
