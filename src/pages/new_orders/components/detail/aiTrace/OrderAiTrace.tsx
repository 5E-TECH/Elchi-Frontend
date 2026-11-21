// dizayn-v2: superadmin-orders-detail-ai-trace-dialog, admin-orders-detail-ai-trace-dialog
import { useId, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, CircleCheck, Clock, EyeOff, History, Sparkles, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AI_TRACE_RETENTION_DAYS, useOrderAiTrace, type AiOrderTrace } from "../../../../../entities/ai-order";
import { useCustomerDistrictNames } from "../../../../../entities/customer";
import { useLogistics } from "../../../../../entities/logistics/api/logisticsApi";
import { formatOrderRef } from "../../../../../entities/order";
import { userDetailQuery } from "../../../../../entities/user/api/userApi";
import { unwrapUserResponse } from "../../../../../entities/user/lib/normalizeUser";
import { getUserRoleLabelKey } from "../../../../../entities/user/lib/role";
import { formatTrackingDateTime } from "../../../../../features/order-tracking";
import { formatDateLocalized } from "../../../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../../../shared/lib/formatMoney";
import { Badge, Button, Dialog, type Tone } from "../../../../../shared/ui/primitives";
import type { OrderDetail } from "../orderDetailModel";
import {
  canViewAiTrace,
  checkRows,
  editedRows,
  retentionDate,
  splitSourceText,
  unchangedCount,
  type CheckStatus,
  type TraceLookups,
  type TraceValue,
} from "./aiTraceModel";

/**
 * «AI IZI» (vncdmXOy; maket `superadmin-orders-detail-ai-trace-dialog`, admin ham shu fragment).
 *
 * Kirish — sarlavhadagi «Yaratish usuli: [AI bilan] [AI izi]» qatori: faqat superadmin va admin
 * (`GET orders/:id/ai-trace` — boshqalarga 403) va faqat iz topilganda (404 — AI bilan yaratilmagan, qator
 * chiqmaydi). Buyurtmada «AI bilan yaratilgan» belgisi yo'q, shuning uchun qatorni iz so'rovining o'zi hal qiladi.
 * Oyna: model va ko'rsatma versiyasi, kim/qachon tasdiqladi, manba matn (`[TEL_n]`), operator o'zgartirgan
 * maydonlar (AI taklifi → yakuniy), ishlagan tekshiruvlar. 30 kundan keyin matn va AI taklifi o'chiriladi.
 */

/** Javob qobig'i qatlamlarga qarab farq qiladi (`region` ro'yxati). */
const toList = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  const inner = (value as { data?: unknown } | null)?.data;
  return Array.isArray(inner) ? (inner as T[]) : [];
};

const STATUS_TONE: Record<CheckStatus, Tone> = { fixed: "success", confirmed: "info", note: "neutral" };

const Value = ({ value, strong = false }: { value: TraceValue; strong?: boolean }) =>
  value.length > 0 ? (
    <span className={strong ? "font-semibold text-text" : "text-text"}>
      {value.map((part, index) => (
        <span key={`${part}-${index}`} className="block [overflow-wrap:anywhere]">
          {part}
        </span>
      ))}
    </span>
  ) : (
    <span className="text-text-muted">—</span>
  );

const SectionHead = ({ id, title, aside }: { id: string; title: string; aside?: ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
    <div className="flex items-center gap-2">
      <h3 id={id} className="text-sm font-semibold text-text">
        {title}
      </h3>
    </div>
    {aside}
  </div>
);

const MetaItem = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex min-w-0 items-baseline justify-between gap-3">
    <dt className="shrink-0 text-text-muted">{label}</dt>
    <dd className="min-w-0 text-right font-semibold text-text [overflow-wrap:anywhere]">{children}</dd>
  </div>
);

type DialogProps = {
  open: boolean;
  onClose: () => void;
  trace: AiOrderTrace;
  order: OrderDetail;
  orderId: string;
};

export const OrderAiTraceDialog = ({ open, onClose, trace, order, orderId }: DialogProps) => {
  const { t, i18n } = useTranslation(["orders", "users"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const ids = { meta: useId(), source: useId(), edited: useId(), checks: useId() };
  const suggestion = trace.ai_suggestion;

  // Nomlar faqat oyna ochilganda va kerak bo'lsa so'raladi (AI taklifidagi viloyat/tuman — id).
  const { useGetRegions } = useLogistics();
  const regionsQuery = useGetRegions(open && Boolean(suggestion?.region_id));
  const regions = toList<{ id: string | number; name?: string | null }>(regionsQuery.data);
  const districtNames = useCustomerDistrictNames(open && suggestion?.district_id ? [suggestion.district_id] : []);
  const confirmerQuery = useQuery({
    ...userDetailQuery(trace.confirmed_by ?? ""),
    enabled: open && Boolean(trace.confirmed_by),
    retry: false,
    meta: { silentError: true },
  });
  const confirmer = unwrapUserResponse(confirmerQuery.data);

  const lookups: TraceLookups = {
    regionName: (id) => (id ? (regions.find((region) => String(region.id) === id)?.name ?? `#${id}`) : null),
    districtName: (id) => (id ? (districtNames[id] ?? `#${id}`) : null),
    money: (amount) => formatMoneyLocalized(amount, { language }),
    delivery: (value) =>
      value === "address" ? t("deliveryToHome") : value === "center" ? t("deliveryToCenter") : null,
    itemLine: (name, count) => t("aiTrace.itemLine", { name, count }),
  };

  const rows = editedRows(trace, order, lookups);
  const checks = checkRows(trace);
  const purgeDate = retentionDate(trace.created_at);
  const purgeDateText = purgeDate ? formatDateLocalized(purgeDate, { language }) : null;
  const confirmedTime = trace.confirmed_at ? formatTrackingDateTime(trace.confirmed_at, { language }) : "—";
  const confirmedBy = confirmer?.name
    ? t("aiTrace.confirmedByValue", {
        name: confirmer.name,
        role: t(getUserRoleLabelKey(confirmer.role), { ns: "users" }),
        time: confirmedTime,
      })
    : trace.confirmed_by
      ? t("aiTrace.confirmedByUnknown", { id: trace.confirmed_by, time: confirmedTime })
      : confirmedTime;
  const sourceMeta = [
    trace.image_count > 0 ? t("aiTrace.sourceImages", { count: trace.image_count }) : null,
    trace.item_index !== null ? t("aiTrace.sourceIndex", { number: trace.item_index + 1 }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const purged = trace.source_purged || (!trace.source_text && !suggestion);

  const checkDetail = (code: (typeof checks)[number]["code"]): string | null => {
    if (!suggestion) return null;
    if (code === "district_low_confidence" && suggestion.district_match) {
      return t("aiTrace.districtRead", {
        text: suggestion.district_match.ai_text,
        district: lookups.districtName(suggestion.district_id) ?? "—",
      });
    }
    if (code === "price_check" && suggestion.total_price !== null) {
      return t("aiTrace.priceAi", { amount: lookups.money(suggestion.total_price) });
    }
    if (code === "region_inferred" && suggestion.region_id) {
      return t("aiTrace.regionNote", { region: lookups.regionName(suggestion.region_id) });
    }
    return null;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      icon={History}
      title={t("aiTrace.title")}
      description={t("aiTrace.subtitle", { order: formatOrderRef(order, orderId) })}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t("aiTrace.close")}
        </Button>
      }
    >
      <div className="flex flex-col gap-5" data-testid="ai-trace-dialog">
        <dl
          aria-label={t("aiTrace.title")}
          className="grid grid-cols-2 gap-x-6 gap-y-2.5 rounded-xl bg-sunken px-4 py-3.5 text-sm max-md:grid-cols-1"
        >
          <MetaItem label={t("aiTrace.model")}>{trace.model}</MetaItem>
          <MetaItem label={t("aiTrace.promptVersion")}>{trace.prompt_version}</MetaItem>
          <MetaItem label={t("aiTrace.analyzedAt")}>
            {trace.created_at ? formatTrackingDateTime(trace.created_at, { language }) : "—"}
          </MetaItem>
          <MetaItem label={t("aiTrace.confirmedBy")}>{confirmedBy}</MetaItem>
        </dl>

        <section aria-labelledby={ids.source} className="flex flex-col gap-2.5">
          <SectionHead
            id={ids.source}
            title={t("aiTrace.sourceTitle")}
            aside={sourceMeta ? <span className="text-xs text-text-muted">{sourceMeta}</span> : null}
          />
          {purged ? (
            <div data-testid="ai-trace-purged" className="flex items-start gap-2.5 rounded-xl bg-sunken px-4 py-3">
              <Clock size={18} aria-hidden="true" className="mt-px shrink-0 text-text-muted" />
              <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                <span className="font-semibold text-text">{t("aiTrace.purgedTitle")}</span>
                <span className="text-text-muted">
                  {purgeDateText
                    ? t("aiTrace.purgedText", { date: purgeDateText })
                    : t("aiTrace.purgedTextNoDate")}
                </span>
              </div>
            </div>
          ) : trace.source_text ? (
            <>
              <p
                data-testid="ai-trace-source"
                aria-label={t("aiTrace.sourceListLabel")}
                className="rounded-xl bg-sunken px-4 py-3 text-sm/relaxed whitespace-pre-wrap text-text [overflow-wrap:anywhere]"
              >
                {splitSourceText(trace.source_text).map((part, index) =>
                  part.phone ? (
                    <span key={index} className="font-semibold">
                      {part.text}
                    </span>
                  ) : (
                    <span key={index}>{part.text}</span>
                  ),
                )}
              </p>
              {purgeDateText ? (
                <p className="flex items-start gap-1.5 text-xs text-text-muted">
                  <EyeOff size={14} aria-hidden="true" className="mt-px shrink-0" />
                  <span>{t("aiTrace.sourceHidden", { days: AI_TRACE_RETENTION_DAYS, date: purgeDateText })}</span>
                </p>
              ) : null}
            </>
          ) : null}
        </section>

        {trace.edited_fields !== null ? (
          <section aria-labelledby={ids.edited} className="flex flex-col gap-2.5 border-t border-border pt-5">
            {rows.length === 0 ? (
              <div data-testid="ai-trace-no-edits" className="flex items-start gap-2.5 rounded-xl bg-sunken px-4 py-3">
                <CircleCheck size={18} aria-hidden="true" className="mt-px shrink-0 text-success-fg" />
                <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                  <h3 id={ids.edited} className="font-semibold text-text">
                    {t("aiTrace.noEditsTitle")}
                  </h3>
                  <span className="text-text-muted">{t("aiTrace.noEditsText")}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h3 id={ids.edited} className="text-sm font-semibold text-text">
                    {t("aiTrace.editedTitle")}
                  </h3>
                  <Badge>{t("aiTrace.count", { count: rows.length })}</Badge>
                </div>

                {/* Desktop — jadval; telefonda (< 768) — har maydon alohida blok (maket). */}
                <table data-testid="ai-trace-edited" className="w-full border-collapse text-sm max-md:hidden">
                  <thead>
                    <tr className="bg-sunken text-left text-xs font-semibold tracking-wide text-text-muted uppercase">
                      <th scope="col" className="rounded-l-lg px-3 py-2.5">
                        {t("aiTrace.colField")}
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        {t("aiTrace.colAi")}
                      </th>
                      <th scope="col" className="rounded-r-lg px-3 py-2.5">
                        {t("aiTrace.colFinal")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.field} data-field={row.field} className="border-b border-border align-top last:border-b-0">
                        <th scope="row" className="px-3 py-3 text-left font-normal text-text">
                          {t(`aiTrace.field.${row.field}`)}
                        </th>
                        <td className="px-3 py-3">
                          <Value value={row.ai} />
                        </td>
                        <td className="px-3 py-3">
                          <Value value={row.final} strong />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul data-testid="ai-trace-edited-list" className="hidden flex-col max-md:flex">
                  {rows.map((row) => (
                    <li
                      key={row.field}
                      className="flex flex-col gap-1.5 border-b border-border py-3 text-sm first:pt-0 last:border-b-0"
                    >
                      <span className="font-semibold text-text">{t(`aiTrace.field.${row.field}`)}</span>
                      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
                        <dt className="text-text-muted">{t("aiTrace.colAi")}</dt>
                        <dd>
                          <Value value={row.ai} />
                        </dd>
                        <dt className="text-text-muted">{t("aiTrace.colFinal")}</dt>
                        <dd>
                          <Value value={row.final} strong />
                        </dd>
                      </dl>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-text-muted">{t("aiTrace.restSame", { count: unchangedCount(trace) })}</p>
              </>
            )}
          </section>
        ) : null}

        {checks.length > 0 ? (
          <section aria-labelledby={ids.checks} className="flex flex-col gap-1 border-t border-border pt-5">
            <div className="flex items-center gap-2">
              <h3 id={ids.checks} className="text-sm font-semibold text-text">
                {t("aiTrace.checksTitle")}
              </h3>
              <Badge>{t("aiTrace.count", { count: checks.length })}</Badge>
            </div>
            <ul data-testid="ai-trace-checks" className="flex flex-col">
              {checks.map(({ code, status }) => {
                const detail = checkDetail(code);
                return (
                  <li
                    key={code}
                    data-code={code}
                    className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-border py-3 last:border-b-0"
                  >
                    <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-warning-fg" />
                    <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5 text-sm">
                      <span className="font-semibold text-text">{t(`aiTrace.check.${code}`)}</span>
                      {detail ? <span className="text-[13px] text-text-muted [overflow-wrap:anywhere]">{detail}</span> : null}
                    </div>
                    <Badge tone={STATUS_TONE[status]} className="ml-auto">
                      {status === "fixed" ? <Check size={14} aria-hidden="true" /> : null}
                      {t(`aiTrace.status.${status}`)}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </Dialog>
  );
};

type RowProps = {
  orderId: string;
  order: OrderDetail | null;
  role: unknown;
};

/**
 * Sarlavha qatori «Yaratish usuli: [✦ AI bilan] [AI izi]» — `DetailHeader` tavsifi ostida. Faqat superadmin/admin va
 * iz topilganda; aks holda hech narsa chizilmaydi (so'rov ham boshqa rollarda ketmaydi).
 */
export const OrderAiTraceRow = ({ orderId, order, role }: RowProps) => {
  const { t } = useTranslation("orders");
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const allowed = canViewAiTrace(role);
  const query = useOrderAiTrace(orderId, allowed && Boolean(order));
  const trace = query.data;
  if (!allowed || !order || !trace) return null;

  return (
    <span
      role="group"
      aria-labelledby={labelId}
      data-testid="order-ai-trace-row"
      className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5"
    >
      <span id={labelId} className="text-[13px] text-text-muted">
        {t("aiTrace.methodLabel")}
      </span>
      <Badge>
        <Sparkles size={14} aria-hidden="true" />
        {t("aiTrace.methodAi")}
      </Badge>
      <Button variant="ghost" size="sm" leftIcon={History} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {t("aiTrace.open")}
      </Button>
      <OrderAiTraceDialog open={open} onClose={() => setOpen(false)} trace={trace} order={order} orderId={orderId} />
    </span>
  );
};
