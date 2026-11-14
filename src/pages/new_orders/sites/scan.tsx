// dizayn-v2: (maket yo'q) superadmin-integrations-legacy-source-detail
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Globe, ScanLine } from "lucide-react";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { cx } from "../../../shared/lib/cx";
import { formatTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { latinizeKeyboardLayout } from "../../../shared/lib/scanToken";
import { playScanFeedback } from "../../../shared/lib/scanner/feedback";
import { useScanTarget, type ScanTargetListItem } from "../../../shared/lib/scanner/scanTargets";
import { useKeyboardScanner } from "../../../shared/lib/useKeyboardScanner";
import { useScannerListening } from "../../../shared/lib/useScannerListening";
import { integrationKeys, useGetIntegrationById } from "../../../entities/integrations";
import { importSiteOrders, searchSiteOrderByQr } from "../../../entities/integrations/siteIntake";
import { incomingOrdersKey, incomingSourcesKey, receiveTokensInChunks } from "../../../entities/incoming-orders";
import { isOrderReceiveClosedError, useOrderIntake } from "../../../entities/order-intake";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  Spinner,
  TONE_SOFT,
  useConfirm,
} from "../../../shared/ui/primitives";
import ScanInput from "../../incoming-orders/ui/ScanInput";
import { ScanMessage, type ScanMessageData, type ScanMessageUndo } from "../../incoming-orders/ui/ScanMessage";
import {
  EXISTING_SKIP_REASONS,
  knownSkipReason,
  previewsTotal,
  qrSearchEndpoint,
  readSiteMapping,
  toSitePreview,
  unwrapSiteOrders,
  type SiteOrderPreview,
} from "./model/siteOrder";
import SiteOrdersTable, { siteOrderLabel } from "./ui/SiteOrdersTable";

/** Bundan qisqa qiymat fokussiz yo'lda skan emas, odam bosgan tugma (`incoming-orders` dagi chegara). */
const KEYBOARD_SCAN_MIN_LENGTH = 6;

/** `.el-overline` · `.el-stat-value` · `.el-stat-unit` (CODE-MAP 0.2, 2.4) — «Kiruvchi posilkalar» skani bilan bir xil. */
const OVERLINE = "text-xs font-semibold uppercase tracking-[.05em] text-text-muted";
const STAT_VALUE = "m-0 whitespace-nowrap text-[28px] leading-9 font-bold tracking-[-.01em] text-text";
const STAT_UNIT = "ml-1 text-sm font-semibold tracking-normal text-text-muted";

const httpStatus = (error: unknown) => (error as { response?: { status?: number } } | null)?.response?.status;

/** Skan xabarining kulrang davomi: «Rustam Jo'rayev, +998 90 …». */
const previewDetail = (row: SiteOrderPreview) => [row.name, row.address].filter(Boolean).join(", ") || undefined;

/**
 * «TASHQI SAYTLAR» → SAYT SKANI (BeePost «Tashqi buyurtmalar» naqshi).
 *
 * Oqim:
 *  1. Operator posilkadagi saytning QR'ini skanerlaydi (USB skaner, maydon yoki kamera).
 *  2. Elchi saytdan shu QR bo'yicha buyurtmani so'raydi (`search-by-qr`) va uni RO'YXATGA qo'shadi — hali hech
 *     narsa yaratilmaydi; noto'g'ri skanerlangan posilka «olib tashlash» bilan chiqariladi.
 *  3. «Qabul qilish» (tasdiq bilan): buyurtmalar ulanishning marketi nomidan yaratiladi (`orders/external/receive`)
 *     va o'sha zahoti QR bo'yicha qabul qilinadi (`orders/external/receive-by-scan` — skan qabulining yagona yo'li,
 *     kun tartibi va filial chegarasi bilan). O'tmagan qator ro'yxatda sababi bilan qoladi.
 *
 * SKANLAR NAVBATDA: har skan saytga so'rov, USB skaner esa tez — so'rovlar ketma-ket yuboriladi, takror QR
 * navbatdaligida ham ushlanadi (aks holda bitta posilka ikki qator bo'lardi).
 *
 * Maket yo'q — eng yaqini `superadmin-integrations-legacy-source-detail` (sarlavha «← orqaga · nom · Ulangan»,
 * «Skanerlash» kartasi, «Skanerlangan buyurtmalar» jadvali) va `superadmin-neworders-incoming-scan` (skaner maydoni,
 * raqamlar, oxirgi skan xabari, «Qabul qilish» — yagona asosiy tugma).
 */
const SiteScanPage = () => {
  const { t, i18n } = useTranslation("newOrders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { integrationId } = useParams<{ integrationId: string }>();
  const confirm = useConfirm();
  const client = useQueryClient();

  const query = useGetIntegrationById(integrationId, { silentError: true });
  const integration = query.data?.data ?? null;
  const marketName = (integration?.market?.name ?? "").trim() || null;
  const mapping = useMemo(() => readSiteMapping(integration?.field_mapping), [integration]);
  const endpoint = integration ? qrSearchEndpoint(integration) : undefined;

  const intake = useOrderIntake();
  const receiveClosed = intake.receiveClosed;
  const refetchIntake = intake.query.refetch;

  const inputRef = useRef<HTMLInputElement>(null);
  const listening = useScannerListening(inputRef);

  /** Ro'yxat — yangisi tepada. `rowsRef` — navbat va qabul har doim eng so'nggi ro'yxatni ko'rsin. */
  const [rows, setRows] = useState<SiteOrderPreview[]>([]);
  const rowsRef = useRef<SiteOrderPreview[]>([]);
  const updateRows = useCallback((next: (prev: SiteOrderPreview[]) => SiteOrderPreview[]) => {
    rowsRef.current = next(rowsRef.current);
    setRows(rowsRef.current);
  }, []);

  const [message, setMessage] = useState<ScanMessageData | null>(null);
  const [accepting, setAccepting] = useState(false);

  /** Saytga ketishi kerak bo'lgan QR'lar (navbat) va hozir so'ralayotgani — takror skanni ushlash uchun. */
  const queueRef = useRef<string[]>([]);
  const inFlightRef = useRef(new Set<string>());
  const drainingRef = useRef(false);
  const [searching, setSearching] = useState(0);

  /** Navbatdagi so'rovlar eng so'nggi ulanish sozlamasi bilan (sahifa ochilgach ulanish qayta o'qilsa ham). */
  const contextRef = useRef({ slug: "", endpoint: endpoint as string | undefined, mapping });
  useEffect(() => {
    contextRef.current = { slug: integration?.slug ?? "", endpoint, mapping };
  }, [endpoint, integration?.slug, mapping]);

  useEffect(() => {
    if (integration) inputRef.current?.focus();
  }, [integration]);

  const searchOne = async (qr: string) => {
    const { slug, endpoint: searchEndpoint, mapping: siteMapping } = contextRef.current;
    try {
      const payload = await searchSiteOrderByQr({ slug, qr, endpoint: searchEndpoint });
      const previews = unwrapSiteOrders(payload, siteMapping).map((raw) => toSitePreview(raw, siteMapping, qr));
      if (!previews.length) {
        const text = t("sites.notFound");
        void playScanFeedback("missing", text);
        setMessage({ tone: "error", text, detail: qr });
        return;
      }
      const known = rowsRef.current;
      const fresh = previews.filter(
        (preview, index) =>
          previews.findIndex((other) => other.key === preview.key) === index &&
          !known.some(
            (row) => row.key === preview.key || (preview.externalId !== null && row.externalId === preview.externalId),
          ),
      );
      if (!fresh.length) {
        const text = t("sites.duplicate", { order: siteOrderLabel(previews[0]) });
        void playScanFeedback("error", text, undefined, { voice: "duplicate" });
        setMessage({ tone: "warn", text });
        return;
      }
      updateRows((prev) => [...fresh, ...prev]);
      const text = t("sites.added", { order: siteOrderLabel(fresh[0]) });
      void playScanFeedback("success", text, undefined, { voice: "added" });
      setMessage({
        tone: "success",
        text:
          fresh.length > 1
            ? t("sites.addedMany", { value: formatNumberLocalized(fresh.length, { language }) })
            : text,
        detail: fresh.length > 1 ? undefined : previewDetail(fresh[0]),
        undoIds: fresh.map((row) => row.key),
      });
    } catch (error) {
      const text = httpStatus(error) === 404 ? t("sites.notFound") : t("sites.searchError");
      void playScanFeedback(httpStatus(error) === 404 ? "missing" : "error", text);
      setMessage({ tone: "error", text, detail: getBackendErrorMessage(error) ?? qr });
    }
  };

  const drain = async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      while (queueRef.current.length) {
        const qr = queueRef.current.shift() as string;
        setSearching(queueRef.current.length + 1);
        inFlightRef.current.add(qr);
        try {
          await searchOne(qr);
        } finally {
          inFlightRef.current.delete(qr);
        }
      }
    } finally {
      drainingRef.current = false;
      setSearching(0);
    }
  };

  const handleScan = (raw: string) => {
    const qr = latinizeKeyboardLayout(raw).trim();
    if (!qr) return;
    if (!integration) {
      const text = t("sites.notReady");
      void playScanFeedback("error", text);
      setMessage({ tone: "error", text });
      return;
    }
    const queued = queueRef.current.includes(qr) || inFlightRef.current.has(qr);
    const existing = rowsRef.current.find((row) => row.key === qr);
    if (queued || existing) {
      const text = t("sites.duplicate", { order: existing ? siteOrderLabel(existing) : qr });
      void playScanFeedback("error", text, undefined, { voice: "duplicate" });
      setMessage({ tone: "warn", text });
      return;
    }
    queueRef.current.push(qr);
    void drain();
  };

  useKeyboardScanner({
    enabled: Boolean(integration) && listening,
    onScan: (value) => {
      if (value.length < KEYBOARD_SCAN_MIN_LENGTH) return false;
      handleScan(value);
      return true;
    },
  });

  const removeRows = useCallback(
    (keys: readonly string[]) => {
      const drop = new Set(keys);
      updateRows((prev) => prev.filter((row) => !drop.has(row.key)));
      inputRef.current?.focus();
    },
    [updateRows],
  );
  const handleRemove = useCallback((row: SiteOrderPreview) => removeRows([row.key]), [removeRows]);

  /** Backend `skipped[].reason` → operatorga tushunarli matn. */
  const reasonText = (reason: string) => {
    const known = knownSkipReason(reason);
    return known ? t(`sites.reason.${known}`) : t("sites.reason.other", { reason });
  };

  const accept = async () => {
    const current = rowsRef.current;
    if (!integration || !current.length) return;
    const errors = new Map<string, string>();

    // 1) Yaratish. Birinchi bo'lak yiqilsa — hech narsa yaratilmagan, xato yuqoriga (qatorlar o'zgarmaydi).
    const imported = await importSiteOrders(
      integration.id,
      current.map((row) => ({ key: row.key, payload: row.payload })),
    );
    imported.skipped.forEach((skip) => {
      if (EXISTING_SKIP_REASONS.includes(skip.reason) || skip.external_id === null) return;
      const row = current.find((item) => item.externalId === String(skip.external_id));
      if (row) errors.set(row.key, reasonText(skip.reason));
    });
    imported.failed.forEach((fail) => {
      errors.set(fail.key, getBackendErrorMessage(fail.reason) ?? t("sites.sendFailed"));
    });

    // 2) Qabul — yaratilgan (yoki avval yaratilib, qabul qilinmay qolgan) buyurtmalar QR bo'yicha.
    const toReceive = current.filter((row) => !errors.has(row.key));
    let received = 0;
    if (toReceive.length) {
      try {
        const result = await receiveTokensInChunks(toReceive.map((row) => row.qr));
        received = result.received;
        result.unmatched.forEach((miss) => {
          const row = toReceive.find((item) => item.qr === miss.token);
          if (row) errors.set(row.key, miss.reason);
        });
      } catch (error) {
        // Buyurtmalar yaratildi, qabul esa o'tmadi (masalan kun tartibi bo'yicha yopildi): qatorlar qoladi, keyingi
        // urinishda yaratish «already_exists» bilan o'tadi va qabul qaytadan so'raladi.
        if (isOrderReceiveClosedError(error)) void refetchIntake();
        const reason = getBackendErrorMessage(error) ?? t("sites.acceptError");
        toReceive.forEach((row) => errors.set(row.key, reason));
      }
    }

    client.invalidateQueries({ queryKey: ["orders"] });
    client.invalidateQueries({ queryKey: ["dashboard"] });
    client.invalidateQueries({ queryKey: [incomingOrdersKey] });
    client.invalidateQueries({ queryKey: [incomingSourcesKey] });
    client.invalidateQueries({ queryKey: integrationKeys.all });

    // Qabul qilinganlar ro'yxatdan chiqadi; qolganlarida — sababi. Shu orada skanerlangan yangi qatorlar tegilmaydi.
    const sent = new Set(current.map((row) => row.key));
    updateRows((prev) =>
      prev
        .filter((row) => !sent.has(row.key) || errors.has(row.key))
        .map((row) => (sent.has(row.key) ? { ...row, error: errors.get(row.key) } : row)),
    );
    return { received, failed: errors.size };
  };

  const handleAccept = async () => {
    const current = rowsRef.current;
    if (!current.length || accepting || receiveClosed || searching > 0) return;
    const value = formatNumberLocalized(current.length, { language });
    const ok = await confirm({
      title: t("sites.acceptTitle", { value }),
      description: t("sites.acceptDescription", { market: marketName ?? integration?.name ?? "" }),
      icon: Check,
      iconTone: "info",
      confirmLabel: t("sites.acceptAction"),
      confirmIcon: Check,
      rows: [
        { label: t("sites.statScanned"), value: t("sites.countValue", { value }) },
        { label: t("sites.statSum"), value: formatMoneyLocalized(previewsTotal(current), { language }) },
      ],
    });
    if (!ok) {
      inputRef.current?.focus();
      return;
    }
    setAccepting(true);
    try {
      const outcome = await accept();
      if (!outcome) return;
      const received = formatNumberLocalized(outcome.received, { language });
      if (!outcome.failed) {
        notify.success(t("sites.acceptDone", { value: received }));
        setMessage({ tone: "success", text: t("sites.acceptDone", { value: received }) });
      } else {
        const failed = formatNumberLocalized(outcome.failed, { language });
        setMessage({
          tone: outcome.received > 0 ? "warn" : "error",
          text: t("sites.acceptPartial", { received, failed }),
          detail: t("sites.acceptPartialDetail"),
        });
      }
    } catch (error) {
      if (isOrderReceiveClosedError(error)) void refetchIntake();
      setMessage({ tone: "error", text: getBackendErrorMessage(error) ?? t("sites.acceptError") });
    } finally {
      setAccepting(false);
      inputRef.current?.focus();
    }
  };

  const unit = t("sites.unitTa");
  const total = previewsTotal(rows);
  const siteName = integration?.name ?? "";

  // Kamera (markaziy «Skaner» tugmasi) — skan aynan `handleScan` ga tushadi, ro'yxat ham shu.
  const cameraList: ScanTargetListItem[] = rows.map((row) => ({
    key: row.key,
    title: siteOrderLabel(row),
    subtitle: [row.qr, row.amount === null ? null : formatMoneyLocalized(row.amount, { language })]
      .filter(Boolean)
      .join(" · "),
    tone: row.error ? "danger" : "success",
    onUndo: () => handleRemove(row),
  }));

  useScanTarget(
    integration
      ? {
          id: `site:${integration.id}`,
          title: t("sites.cameraTitle"),
          context: t("sites.cameraContext", { site: siteName, market: marketName ?? "—" }),
          progress: { done: rows.length, label: t("sites.statScanned") },
          list: cameraList,
          listTitle: t("sites.listTitle"),
          onScan: (raw) => handleScan(raw),
          finish: { label: t("ui:camera.action.finish"), onFinish: () => undefined },
        }
      : null,
  );

  const messageUndoKeys = (message?.undoIds ?? []).filter((key) => rows.some((row) => row.key === key));
  const messageUndo: ScanMessageUndo | null = messageUndoKeys.length
    ? {
        label: t("sites.removeLast", { value: formatNumberLocalized(messageUndoKeys.length, { language }) }),
        onUndo: () => removeRows(messageUndoKeys),
      }
    : null;

  if (query.isError && !integration) {
    const notFound = httpStatus(query.error) === 404;
    return (
      <div className="flex flex-col gap-6 max-md:gap-4">
        <PageHeader back="/new-orders/sites" backLabel={t("sites.backLabel")} title={t("shell.sitesTab")} />
        <ErrorState
          framed
          kind={notFound ? "generic" : undefined}
          error={query.error}
          title={notFound ? t("sites.siteNotFound") : t("sites.siteLoadError")}
          onRetry={notFound ? undefined : () => void query.refetch()}
          retrying={query.isFetching}
        />
      </div>
    );
  }

  const title = integration ? (
    siteName
  ) : (
    <>
      <span className="sr-only">{t("shell.sitesTab")}</span>
      <Skeleton shape="block" width={180} height={28} className="inline-block align-middle" />
    </>
  );

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        back="/new-orders/sites"
        backLabel={t("sites.backLabel")}
        title={title}
        meta={
          integration ? (
            <Badge tone={integration.is_active ? "success" : "neutral"} dot>
              {integration.is_active ? t("sites.connected") : t("sites.inactive")}
            </Badge>
          ) : null
        }
        description={integration ? t("sites.scanDescription", { market: marketName ?? "—" }) : undefined}
        actions={
          <Button
            leftIcon={Check}
            disabled={!rows.length || receiveClosed || searching > 0}
            loading={accepting}
            loadingText={t("sites.accepting")}
            onClick={() => void handleAccept()}
          >
            {t("sites.accept", { value: formatNumberLocalized(rows.length, { language }) })}
            <span className="max-md:hidden">{t("sites.acceptUnit", { count: rows.length })}</span>
          </Button>
        }
      />

      {receiveClosed ? (
        // `.el-alert` — «Kiruvchi posilkalar» va market yangi buyurtmalaridagi ogohlantirish bilan bir xil.
        <div
          role="status"
          data-testid="sites-receive-closed"
          className={cx("flex items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.warning)}
        >
          <Clock size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1 text-text [overflow-wrap:anywhere]">
            <div className="font-bold">
              {t("marketOrders.receiveClosedTitle", { time: intake.receiveCutoffTime ?? "" })}
            </div>
            {intake.receiveReopensAt
              ? t("marketOrders.receiveClosedReopens", { time: formatTimeLocalized(intake.receiveReopensAt) })
              : t("marketOrders.receiveClosedBody")}
          </div>
        </div>
      ) : null}

      {/* ===== Skaner + raqamlar + oxirgi natija ===== */}
      <Card aria-label={t("sites.scanCardLabel")} bodyClassName="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2">
            <ScanInput
              inputRef={inputRef}
              onScan={handleScan}
              placeholder={t("sites.scanPlaceholder")}
              label={t("sites.scanInputLabel")}
            />
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {searching > 0 ? (
                <Badge tone="info" role="status">
                  <Spinner size="sm" className="mr-1.5" />
                  {t("sites.searching", { value: formatNumberLocalized(searching, { language }) })}
                </Badge>
              ) : integration && listening ? (
                <Badge tone="success" dot role="status" className="max-md:hidden">
                  {t("sites.scannerReady")}
                </Badge>
              ) : null}
              <span className="text-xs text-text-muted max-md:hidden">{t("sites.scannerHint")}</span>
            </div>
          </div>

          <dl className="m-0 flex items-end gap-8">
            <div className="flex flex-col gap-0.5">
              <dt className={OVERLINE}>{t("sites.statScanned")}</dt>
              <dd className={STAT_VALUE}>
                <span className="text-success-fg">{formatNumberLocalized(rows.length, { language })}</span>
                {unit ? <span className={STAT_UNIT}>{unit}</span> : null}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className={OVERLINE}>{t("sites.statSum")}</dt>
              <dd className={STAT_VALUE}>{formatMoneyLocalized(total, { language })}</dd>
            </div>
          </dl>
        </div>

        {message ? <ScanMessage message={message} undo={messageUndo} /> : null}
      </Card>

      {/* ===== Skanerlangan buyurtmalar ===== */}
      <Card padding="none" title={t("sites.listTitle")}>
        {rows.length ? (
          <SiteOrdersTable rows={rows} onRemove={handleRemove} busy={accepting} />
        ) : (
          <EmptyState
            icon={integration ? ScanLine : Globe}
            title={t("sites.listEmptyTitle")}
            description={t("sites.listEmptyText")}
          />
        )}
      </Card>
    </div>
  );
};

/** Boshqa saytga o'tilsa — ro'yxat, navbat va xabar yangidan (`key={integrationId}`). */
const SiteScanRoute = () => {
  const { integrationId } = useParams<{ integrationId: string }>();
  return <SiteScanPage key={integrationId} />;
};

export default memo(SiteScanRoute);
