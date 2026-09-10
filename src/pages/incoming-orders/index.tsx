import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Inbox,
  Loader2,
  RefreshCw,
  ScanLine,
} from "lucide-react";
import type { RootState } from "../../app/config/store";
import { extractScannerToken } from "../../shared/lib/scanToken";
// `shared/components/ScanFeedbackOverlay` ham aynan shu joydan import qiladi —
// ovozli/vizual qaytarma app darajasida mount qilingan, shu bois bu sahifadan
// ham ishlaydi.
import { playScanFeedback } from "../scan/lib/scanShared";
import { getBackendErrorMessage } from "../../shared/lib/backendError";
import {
  extractIncomingOrders,
  extractMeta,
  useIncomingExternalOrders,
  type IncomingOrder,
} from "../../entities/incoming-orders";
import { useOrders } from "../../entities/orders";

/**
 * Bu ekranga kimlar kira oladi — backend guardi bilan BIR XIL bo'lishi shart.
 *
 * `manager` 2026-09-10 da qo'shildi: hamkordan (BeePost) kelgan posilkalar HQ
 * da qabul qilinadi va buni HQ menejeri bajaradi.
 *
 * ⚠️ ROL O'ZI YETARLI EMAS. Backend menejer va registratorni O'Z FILIALI bilan
 * cheklaydi (`resolveReceiveBranchScope`): begona filial buyurtmasi bo'lsa
 * butun so'rov rad etiladi, filiali yo'q xodim esa hech nima qabul qila
 * olmaydi. Bu yerdagi ro'yxat faqat ekranni ko'rsatadi — haqiqiy chegara
 * serverda.
 */
const ALLOWED_ROLES = new Set([
  "superadmin",
  "admin",
  "registrator",
  "manager",
]);

const formatMoney = (value: unknown) =>
  typeof value === "number" ? `${value.toLocaleString("uz-UZ")} so'm` : "—";

const orderLabel = (order: IncomingOrder) =>
  order.order_number ? `#${order.order_number}` : order.id.slice(0, 8);

const districtName = (order: IncomingOrder) =>
  order.customer?.district?.name ?? order.district?.name ?? "—";

type Message = { tone: "success" | "error" | "warn"; text: string };

/**
 * HAMKORDAN KELGAN BUYURTMALARNI SKANERLAB QABUL QILISH (HQ).
 *
 * Nima uchun kerak: hamkor (BeePost) Partner API orqali posilka yaratganda
 * buyurtma bizda `new` holatida paydo bo'ladi, lekin JISMONAN hali yetib
 * kelmagan. Operator posilkalarni qo'lida ushlab QR'ini skanerlaydi — shunda
 * tizimdagi yozuv bilan haqiqiy posilka mos kelishi TASDIQLANADI va faqat
 * skanerlangan buyurtmalar qabul qilinadi.
 *
 * DIZAYN QARORI — skan har safar serverga so'rov YUBORMAYDI. Ro'yxat bir marta
 * yuklanadi va skanerlangan token ro'yxatdagi `qr_code_token` bilan solishtiriladi.
 * Sabab: (a) skaner tez ishlaydi, har skanda so'rov kutish operatorni sekinlashtiradi;
 * (b) bu ro'yxatda YO'Q posilkani tasodifan qabul qilishning oldini oladi.
 */
const IncomingOrdersPage = () => {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const role = useSelector((state: RootState) => state.role.role);
  const allowed = Boolean(role && ALLOWED_ROLES.has(role));

  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<Message | null>(null);

  const query = useIncomingExternalOrders({ status: "new", limit: 200 });
  const { createReceiveOrder } = useOrders();

  const orders = useMemo(
    () => extractIncomingOrders(query.data),
    [query.data],
  );
  const meta = extractMeta(query.data);
  const total = meta?.total ?? orders.length;

  /** Skanerlangan token → buyurtma. Har skanda qayta qurilmaydi. */
  const byToken = useMemo(() => {
    const map = new Map<string, IncomingOrder>();
    for (const order of orders) {
      const token = String(order.qr_code_token ?? "").trim();
      if (token) map.set(token, order);
    }
    return map;
  }, [orders]);

  // Skaner klaviatura sifatida ishlaydi — maydon doim fokusda turishi kerak.
  useEffect(() => {
    if (allowed) inputRef.current?.focus();
  }, [allowed]);

  // Ro'yxat yangilanganda skanerlanganlar tozalanadi (qabul qilingandan keyin
  // eski belgilar qolib, operatorni chalg'itmasin).
  useEffect(() => {
    setScannedIds(new Set());
  }, [query.dataUpdatedAt]);

  const handleScan = (raw: string) => {
    const token = extractScannerToken(raw) ?? raw.trim();
    if (!token) return;

    const order = byToken.get(token);
    if (!order) {
      void playScanFeedback("missing");
      setMessage({ tone: "error", text: t("incomingScanNotFound") });
      return;
    }
    if (scannedIds.has(order.id)) {
      void playScanFeedback("error");
      setMessage({
        tone: "warn",
        text: `${orderLabel(order)} — ${t("incomingScanDuplicate")}`,
      });
      return;
    }

    void playScanFeedback("success");
    setScannedIds((prev) => new Set(prev).add(order.id));
    setMessage({
      tone: "success",
      text: `${orderLabel(order)} — ${t("incomingScanAdded")}`,
    });
  };

  const handleReceive = () => {
    const ids = Array.from(scannedIds);
    if (!ids.length) return;

    createReceiveOrder.mutate(
      { order_ids: ids },
      {
        onSuccess: () => {
          setMessage({
            tone: "success",
            text: `${ids.length} ${t("incomingReceiveSuccess")}`,
          });
          setScannedIds(new Set());
          void query.refetch();
          inputRef.current?.focus();
        },
        onError: (error) => {
          // Backend sababini ATAYLAB ko'rsatamiz (masalan "ba'zi buyurtmalar
          // NEW holatida emas") — umumiy xabar operatorni ko'r qoldirardi.
          setMessage({
            tone: "error",
            text: getBackendErrorMessage(error) ?? t("incomingReceiveError"),
          });
        },
      },
    );
  };

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-8 text-center dark:bg-primarydark">
        <AlertTriangle className="mx-auto text-amber-500" size={32} />
        <p className="m-0 mt-4 text-sm font-semibold text-maindark dark:text-white">
          {t("incomingNoAccess")}
        </p>
      </div>
    );
  }

  const scannedCount = scannedIds.size;

  return (
    <div className="space-y-4">
      {/* ===== Sarlavha + skaner ===== */}
      <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-4 shadow-sm sm:rounded-[28px] sm:p-6 dark:bg-primarydark">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/new-orders/integrations")}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--color-border-soft)] text-maindark transition hover:bg-main/5 dark:text-white"
              title={t("integrationsTitle")}
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-main/10 text-main dark:text-primary">
              <Inbox size={22} />
            </div>
            <div>
              <h1 className="m-0 text-lg font-extrabold text-maindark dark:text-white">
                {t("incomingTitle")}
              </h1>
              <p className="m-0 mt-1 text-xs text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                {t("incomingSubtitle")}
              </p>
            </div>
          </div>

          {/* Raqamlar doim ko'rinadi — operator taxmin qilmasligi kerak. */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
                {t("incomingArrived")}
              </p>
              <p className="m-0 text-xl font-extrabold text-maindark dark:text-white">
                {total}
              </p>
            </div>
            <div className="text-right">
              <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
                {t("incomingScanned")}
              </p>
              <p className="m-0 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {scannedCount} / {orders.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--color-border-soft)] text-maindark transition hover:bg-main/5 disabled:opacity-50 dark:text-white"
              title={t("refresh")}
            >
              <RefreshCw
                size={18}
                className={query.isFetching ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>

        <form
          className="mt-4 flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            handleScan(input);
            setInput("");
          }}
        >
          <div className="relative flex-1">
            <ScanLine
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-main"
            />
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("incomingScanPlaceholder")}
              autoComplete="off"
              className="w-full rounded-2xl border border-[color:var(--color-border-soft)] bg-white py-4 pl-12 pr-4 text-base font-semibold text-maindark outline-none transition focus:border-main dark:bg-white/[0.04] dark:text-white"
            />
          </div>
        </form>

        {message ? (
          <div
            className={`mt-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
              message.tone === "success"
                ? "border-emerald-400/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200"
                : message.tone === "warn"
                  ? "border-amber-400/30 bg-amber-500/12 text-amber-700 dark:text-amber-200"
                  : "border-red-400/30 bg-red-500/12 text-red-700 dark:text-red-200"
            }`}
          >
            <div className="flex items-start gap-2">
              {message.tone === "success" ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              )}
              <span className="[overflow-wrap:anywhere]">{message.text}</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* ===== Ro'yxat ===== */}
      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-primary shadow-sm sm:rounded-[28px] dark:bg-primarydark">
        {query.isLoading ? (
          <div className="flex min-h-[220px] items-center justify-center">
            <Loader2 className="animate-spin text-main" size={28} />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
            <Inbox
              size={32}
              className="text-[color:var(--color-text-muted)]"
            />
            <p className="m-0 text-sm font-semibold text-[color:var(--color-text-muted)]">
              {t("incomingEmpty")}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--color-border-soft)] dark:divide-white/10">
            {orders.map((order) => {
              const scanned = scannedIds.has(order.id);
              return (
                <div
                  key={order.id}
                  className={`flex flex-wrap items-center gap-3 px-4 py-3 transition ${
                    scanned ? "bg-emerald-500/8" : ""
                  }`}
                >
                  <div className="shrink-0">
                    {scanned ? (
                      <CheckCircle2
                        size={22}
                        className="text-emerald-600 dark:text-emerald-400"
                      />
                    ) : (
                      <Circle
                        size={22}
                        className="text-[color:var(--color-text-muted)]/40"
                      />
                    )}
                  </div>
                  <p className="m-0 w-24 shrink-0 font-mono text-sm font-bold text-maindark dark:text-white">
                    {orderLabel(order)}
                  </p>
                  <p className="m-0 min-w-[8rem] flex-1 text-sm font-semibold text-maindark dark:text-white [overflow-wrap:anywhere]">
                    {order.customer?.name ?? "—"}
                  </p>
                  <p className="m-0 w-32 shrink-0 text-sm text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                    {districtName(order)}
                  </p>
                  <p className="m-0 w-32 shrink-0 text-right text-sm font-bold tabular-nums text-maindark dark:text-white">
                    {formatMoney(order.total_price)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== Qabul qilish ===== */}
      <button
        type="button"
        onClick={handleReceive}
        disabled={scannedCount === 0 || createReceiveOrder.isPending}
        className="flex w-full items-center justify-center gap-3 rounded-[24px] bg-emerald-600 px-6 py-5 text-base font-extrabold uppercase tracking-wide text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {createReceiveOrder.isPending ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            {t("incomingReceiving")}
          </>
        ) : (
          <>
            <CheckCircle2 size={18} />
            {t("incomingReceive")} ({scannedCount})
          </>
        )}
      </button>
    </div>
  );
};

export default memo(IncomingOrdersPage);
