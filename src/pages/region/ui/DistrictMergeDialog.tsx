// dizayn-v2: superadmin-regions-districts-merge-dialog, superadmin-regions-districts-merge-target, superadmin-regions-districts-merge-progress, superadmin-regions-districts-merge-result, superadmin-regions-districts-merge-error, superadmin-regions-districts-merge-error-unavailable, superadmin-regions-districts-merge-error-manual, superadmin-regions-districts-merge-unknown, admin-regions-districts-merge-dialog, admin-regions-districts-merge-target, admin-regions-districts-merge-progress, admin-regions-districts-merge-result, admin-regions-districts-merge-error, admin-regions-districts-merge-error-unavailable, admin-regions-districts-merge-error-manual, admin-regions-districts-merge-unknown, superadmin-regions-sato-codes-merge-dialog
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  Building2,
  CircleCheck,
  CircleQuestionMark,
  CircleX,
  Clock,
  Copy,
  Info,
  MapPin,
  Merge,
  RefreshCw,
  ScrollText,
  ShoppingBag,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useNavigate } from "react-router-dom";
import { copyToClipboard } from "../../../shared/lib/clipboard";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import {
  Badge,
  Button,
  Dialog,
  Field,
  Select,
  Skeleton,
  Spinner,
  TONE_SOFT,
  type DialogProps,
  type SelectOption,
} from "../../../shared/ui/primitives";
import {
  formatElapsed,
  MERGE_KINDS,
  mergeErrorVariant,
  mergeReasonLines,
  type MergeCounts,
  type MergeDistrict,
  type MergeKind,
  type MergeReasonLine,
  type MergeState,
  type MergeStranded,
} from "../model/districtMerge";
import { ACTIVITY_LOGS_PATH, useDistrictUsage, type DistrictMergeController } from "./useDistrictMerge";

/** Tuman qatori (`.el-stat-icon` + nom + viloyat) — oynalarning «qaysi tuman» bloki. */
export const DistrictSummary = ({
  label,
  title,
  subtitle,
  icon: Icon = MapPin,
}: {
  label?: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  /** Sukut `MapPin` (tumanlar sahifasi); SATO maketida — `Map`. */
  icon?: LucideIcon;
}) => (
  <div className="flex min-w-0 items-center gap-3 rounded-[10px] bg-sunken px-3 py-2.5">
    <span
      aria-hidden="true"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-muted"
    >
      <Icon size={18} />
    </span>
    <span className="flex min-w-0 flex-col gap-0.5">
      {label ? <span className="text-xs font-semibold text-text-muted">{label}</span> : null}
      <span className="text-sm font-semibold [overflow-wrap:anywhere] text-text">{title}</span>
      <span className="text-[13px] text-text-muted">{subtitle}</span>
    </span>
  </div>
);

/** Izoh qatori (`Info` + 13 px muted matn). */
export const DialogNote = ({ children }: { children: ReactNode }) => (
  <p className="m-0 flex items-start gap-2 text-[13px] text-text-muted">
    <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
    <span className="min-w-0">{children}</span>
  </p>
);

/** `.el-alert` — ton foni, ton rangidagi ikonka, qalin sarlavha + matn. */
const MergeAlert = ({
  tone,
  icon: Icon,
  title,
  children,
  role = "note",
}: {
  tone: "warning" | "info" | "danger";
  icon: LucideIcon;
  title: ReactNode;
  children: ReactNode;
  role?: "note" | "alert";
}) => (
  <div role={role} className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT[tone])}>
    <Icon size={20} aria-hidden="true" className="shrink-0" />
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-text">
      <div className="font-bold">{title}</div>
      <div className="text-[13px]">{children}</div>
    </div>
  </div>
);

const Overline = ({ children, id }: { children: ReactNode; id?: string }) => (
  <p id={id} className="m-0 text-xs font-semibold tracking-[.05em] text-text-muted uppercase">
    {children}
  </p>
);

/** «O'tgan vaqt 0:42» — har soniyada yangilanadi. */
const ElapsedBadge = ({ startedAt }: { startedAt: number }) => {
  const { t } = useTranslation("region");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <Badge icon={Clock} data-testid="merge-elapsed">
      {t("v2.districts.progress.elapsed", { time: formatElapsed(now - startedAt) })}
    </Badge>
  );
};

const ROW_ICONS: Record<MergeKind, LucideIcon> = { orders: ShoppingBag, users: Users, branches: Building2 };

/** Hech bo'lmasa bitta nolmas son bormi (hammasi 0 — blok chizilmaydi). */
const hasCounts = (counts: MergeCounts | null | undefined): counts is MergeCounts =>
  counts != null && MERGE_KINDS.some((kind) => counts[kind] > 0);

/** «128 ta» — `formatNumberLocalized` bilan. */
const useCountTa = () => {
  const { t, i18n } = useTranslation("region");
  return (value: number) =>
    t("v2.common.countTa", { count: formatNumberLocalized(value, { language: i18n.language }) });
};

/**
 * Sonlar ro'yxati («Bog'langan», «… ko'chadi», «Ko'chirilayotganlar», «Ko'chirildi»): har tur — ikonka, nom
 * (foydalanuvchilarda «Mijoz, kuryer va market» izohi), «N ta». Nol qatorlar chizilmaydi (maket: SATO oynasida
 * filialsiz, «servis javob bermadi» da faqat buyurtmalar). Chegarali (`border`) yoki `sunken` fonli (natija).
 */
export const CountList = ({
  counts,
  label,
  surface = "border",
  withHints = true,
}: {
  counts: MergeCounts;
  /** Ro'yxat nomi (ekran o'quvchi). */
  label: string;
  surface?: "border" | "sunken";
  withHints?: boolean;
}) => {
  const { t } = useTranslation("region");
  const countTa = useCountTa();
  const kinds = MERGE_KINDS.filter((kind) => counts[kind] > 0);
  if (!kinds.length) return null;
  return (
    <ul
      aria-label={label}
      className={cx(
        "m-0 list-none rounded-xl px-3 py-0",
        surface === "border" ? "border border-border" : "bg-sunken",
      )}
    >
      {kinds.map((kind) => {
        const Icon = ROW_ICONS[kind];
        return (
          <li
            key={kind}
            className="flex min-h-12 items-center gap-3 border-b border-border py-1.5 last:border-b-0"
          >
            <Icon size={18} aria-hidden="true" className="shrink-0 text-text-muted" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[13px] font-semibold text-text">{t(`v2.districts.rows.${kind}`)}</span>
              {withHints && kind === "users" ? (
                <span className="text-xs text-text-muted">{t("v2.districts.rows.usersHint")}</span>
              ) : null}
            </span>
            <span className="text-sm font-semibold whitespace-nowrap text-text">{countTa(counts[kind])}</span>
          </li>
        );
      })}
    </ul>
  );
};

/** Sarlavhali sonlar bloki (`.el-overline` + ro'yxat); sonlar bo'lmasa — hech narsa. */
export const CountBlock = ({
  title,
  counts,
  label,
  surface,
  withHints,
}: {
  title: ReactNode;
  counts: MergeCounts | null | undefined;
  label: string;
  surface?: "border" | "sunken";
  withHints?: boolean;
}) =>
  hasCounts(counts) ? (
    <div className="flex flex-col gap-2">
      <Overline>{title}</Overline>
      <CountList counts={counts} label={label} surface={surface} withHints={withHints} />
    </div>
  ) : null;

/** Sonlar so'ralayotganda — ro'yxat shaklidagi skelet (3 qator). */
const CountListSkeleton = ({ label }: { label: string }) => (
  <div role="status" aria-busy="true" aria-label={label} className="flex flex-col gap-2">
    <Skeleton width={160} height={12} />
    <div className="rounded-xl border border-border px-3">
      {MERGE_KINDS.map((kind) => (
        <div key={kind} className="flex min-h-12 items-center gap-3 border-b border-border py-1.5 last:border-b-0">
          <Skeleton shape="circle" width={18} height={18} />
          <span className="min-w-0 flex-1">
            <Skeleton width={kind === "users" ? 120 : 88} height={12} />
          </span>
          <Skeleton width={44} height={14} />
        </div>
      ))}
    </div>
  </div>
);

/** «{tuman}da endi» — tirik sonlar, ostida «oldin N ta» (`target_before`). */
const TargetCounts = ({
  name,
  before,
  after,
}: {
  name: string;
  before: MergeCounts | null;
  after: MergeCounts;
}) => {
  const { t } = useTranslation("region");
  const countTa = useCountTa();
  const label = t("v2.districts.result.nowIn", { name });
  return (
    <div className="flex flex-col gap-2">
      <Overline>{label}</Overline>
      <ul aria-label={label} className="m-0 list-none rounded-xl bg-sunken px-3 py-0">
        {MERGE_KINDS.map((key) => {
          const Icon = ROW_ICONS[key];
          return (
          <li
            key={key}
            className="flex min-h-12 items-center gap-3 border-b border-border py-1.5 last:border-b-0"
          >
            <Icon size={18} aria-hidden="true" className="shrink-0 text-text-muted" />
            <span className="min-w-0 flex-1 text-[13px] font-semibold text-text">
              {t(`v2.districts.rows.${key}`)}
            </span>
            <span className="flex flex-col items-end gap-0.5">
              <span className="text-sm font-semibold whitespace-nowrap text-text">{countTa(after[key])}</span>
              {before ? (
                <span className="text-xs whitespace-nowrap text-text-muted">
                  {t("v2.districts.rows.before", { count: countTa(before[key]) })}
                </span>
              ) : null}
            </span>
          </li>
          );
        })}
      </ul>
    </div>
  );
};

/** «Sabab» qatori (`details.reason` dan; server matni emas). Noma'lum kod — chizilmaydi. */
const ReasonBox = ({ lines }: { lines: readonly string[] }) => {
  const { t } = useTranslation("region");
  if (!lines.length) return null;
  return (
    <div
      data-testid="merge-error-reason"
      className="flex flex-col gap-1.5 rounded-[10px] border border-border px-3 py-2.5"
    >
      <span className="text-xs font-semibold text-text-muted">{t("v2.districts.mergeError.reasonLabel")}</span>
      {lines.map((line, index) => (
        <span key={index} className="text-[13px] text-text">
          {line}
        </span>
      ))}
    </div>
  );
};

/**
 * Qaytmagan buyurtmalar raqamlari (`details.stranded_order_ids`, ≤10 ta, Z1c1sNPT): «№7001, №7002 va yana 9 ta»
 * («yana» — qatordagi jami sondan qolgani). Raqam yo'q — `null`.
 */
const strandedIdsText = (
  t: TFunction<"region">,
  ids: readonly string[],
  total: number | null,
  countTa: (value: number) => string,
): string | null => {
  if (!ids.length) return null;
  const list = ids.map((id) => t("v2.districts.mergeError.orderNumber", { id })).join(", ");
  const more = total != null && total > ids.length ? total - ids.length : 0;
  return more > 0 ? t("v2.districts.mergeError.strandedIdsMore", { ids: list, more: countTa(more) }) : list;
};

/** «{manba}ga qaytmadi» — kompensatsiyadan keyin joyiga qaytmagan yozuvlar (`details.stranded`). */
const StrandedList = ({
  title,
  label,
  rows,
  placeOf,
  orderIds = [],
}: {
  title: string;
  label: string;
  rows: readonly MergeStranded[];
  placeOf: (row: MergeStranded) => string;
  /** Z1c1sNPT — birinchi «Buyurtmalar» qatoriga: «{joy}: №7001, №7002 …». */
  orderIds?: readonly string[];
}) => {
  const { t } = useTranslation("region");
  const countTa = useCountTa();
  if (!rows.length) return null;
  const ordersRow = rows.findIndex((row) => row.kind === "orders");
  return (
    <div className="flex flex-col gap-2">
      <Overline>{title}</Overline>
      <ul aria-label={label} className="m-0 list-none rounded-xl border border-border px-3 py-0">
        {rows.map((row, index) => {
          const Icon = ROW_ICONS[row.kind];
          const kind = t(`v2.districts.rows.${row.kind}`);
          const ids = index === ordersRow ? strandedIdsText(t, orderIds, row.count, countTa) : null;
          return (
            <li
              key={`${row.kind}-${index}`}
              className="flex items-start gap-3 border-b border-border py-3 last:border-b-0"
            >
              <Icon size={18} aria-hidden="true" className="mt-px shrink-0 text-text-muted" />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[13px] font-semibold text-text">
                  {row.count == null
                    ? t("v2.districts.mergeError.strandedUnknown", { kind })
                    : t("v2.districts.mergeError.strandedCount", { kind, count: countTa(row.count) })}
                </span>
                <span className="text-xs [overflow-wrap:anywhere] text-text-muted">
                  {ids && row.districtId != null
                    ? t("v2.districts.mergeError.strandedWithIds", { place: placeOf(row), ids })
                    : placeOf(row)}
                </span>
                {/* Joyi aniqlanmagan bo'lsa — raqamlar alohida qatorda (gap «tekshiring: №…» bo'lib qolmasin). */}
                {ids && row.districtId == null ? (
                  <span className="text-xs [overflow-wrap:anywhere] text-text-muted">{ids}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/**
 * Oyna matnlarini almashtirish (SA-2, maket `superadmin-regions-sato-codes-merge-dialog`): SATO takroriylari bir
 * xil nomli — yozuvlar ID va SATO kodi bilan ajratiladi. Berilmagan har band — tumanlar sahifasidagi sukut matn.
 */
export type DistrictMergePresentation = {
  /** Jarayon, natija va «noma'lum» oynalaridagi nom («Bo'ka tumani (ID 203)»). */
  displayName?: (district: MergeDistrict) => string;
  /** Sarlavha ostidagi izoh. */
  description?: (source: MergeDistrict) => ReactNode;
  /** «O'chiriladigan tuman» blokining nomi va ikkinchi qatori. */
  sourceTitle?: (source: MergeDistrict) => ReactNode;
  sourceSubtitle?: (source: MergeDistrict) => ReactNode;
  /** «O'chiriladigan tuman» blokining ikonkasi (sukut `MapPin`; SATO maketida `Map`). */
  sourceIcon?: LucideIcon;
  /** Maqsad ro'yxatidagi variant: nom, ikkinchi qator, qidiruv matni. */
  option?: (candidate: MergeDistrict) => Pick<SelectOption, "label" | "description" | "searchText">;
  /** Tanlangan maqsad yonidagi qo'shimcha (SATO kodi). Qidiruvli ro'yxatda ko'rinmaydi — `searchable: false` bilan. */
  valueAddon?: (target: MergeDistrict) => ReactNode;
  /** Maqsad ro'yxatida qidiruv (sukut `true`). */
  searchable?: boolean;
  /** Maqsad tanlangandagi izoh. */
  targetHint?: (source: MergeDistrict, target: MergeDistrict) => ReactNode;
  /** «Bu amalni qaytarib bo'lmaydi» matni. */
  irreversibleText?: (source: MergeDistrict) => ReactNode;
  /** «{maqsad}ga ko'chadi» sonlar bloki sarlavhasi (SATO: «Nom (ID N) ga ko'chadi»). */
  movesTo?: (target: MergeDistrict) => string;
};

export type DistrictMergeDialogProps = {
  merge: DistrictMergeController;
  /** Matnlarni almashtirish (SATO takroriylari) — sukut: tumanlar sahifasi matnlari. */
  presentation?: DistrictMergePresentation;
  /** Manba viloyatidagi boshqa tumanlar (`mergeCandidates`) — ega S2. */
  candidates: readonly MergeDistrict[];
  /**
   * Yopilgach fokus qayerga. Oyna boshqa oynadan («o'chirib bo'lmaydi») ochilsa, ochgan tugma o'sha oyna
   * bilan yo'qoladi — chaqiruvchi sahifadagi barqaror elementni beradi (sukut: ochgan element).
   */
  returnFocus?: DialogProps["returnFocus"];
};

/** Maketdagi oyna eni (`min(520px,100%)`); primitivda 520 yo'q — kompyuterda `lg` (560) ichida. */
const WIDTH_520 = "md:w-[520px]";

/**
 * «TUMANNI BIRLASHTIRISH» OYNASI (oNAE3LW9) — sahifadan ajratilgan: tumanlar sahifasi (o'chirib bo'lmaydi
 * oynasidan) va SATO takroriylari (SA-2) ochadi. Bir `Dialog`, holatga qarab mazmuni:
 * tanlash (`merge-dialog`, `merge-target`) → jarayon (`merge-progress`, yopilmaydi, `beforeunload`) →
 * natija (`merge-result`, «Ko'chirildi» — `moved_live`) yoki noma'lum (`merge-unknown`, «Qayta urinish» yo'q)
 * yoki xato (`merge-error`, `-error-unavailable`, `-error-manual` — 409/503 dagi `data.reason` / `details` dan,
 * DM-2). «… ko'chadi» / «Ko'chirilayotganlar» sonlari — `GET district/:id/usage`. Jurnal yozuvi nomlari — DM-3.
 */
const DistrictMergeDialog = ({ merge, candidates, returnFocus, presentation }: DistrictMergeDialogProps) => {
  const { t, i18n } = useTranslation("region");
  const nameOf = (district: MergeDistrict) => presentation?.displayName?.(district) ?? district.name;
  const navigate = useNavigate();
  const { state, select, submit, retry, close, refresh } = merge;
  const inProgress = state.phase === "progress";
  const countTa = useCountTa();

  // Jarayonda sahifani yopish/yangilash — brauzer so'raydi (ilova ichidagi o'tish modal oyna ortida yopiq).
  useEffect(() => {
    if (!inProgress) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [inProgress]);

  // Bitta oyna holatdan holatga o'tadi (tanlash → jarayon → natija): bosilgan tugma yo'qoladi, `initialFocus`
  // faqat ochilishda ishlaydi — har o'tishda fokus panelga qo'yiladi (ekran o'quvchi yangi sarlavhani o'qiydi).
  const anchorRef = useRef<HTMLSpanElement>(null);
  const lastPhaseRef = useRef<MergeState["phase"]>(state.phase);
  useEffect(() => {
    const previous = lastPhaseRef.current;
    lastPhaseRef.current = state.phase;
    if (previous === "idle" || state.phase === "idle" || previous === state.phase) return;
    anchorRef.current
      ?.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]')
      ?.focus({ preventScroll: true });
  }, [state.phase]);

  // Yopilgan oynaning oxirgi mazmuni chiqish harakati davomida ko'rinib turadi.
  const [shown, setShown] = useState<MergeState>(state);
  if (state.phase !== "idle" && state !== shown) setShown(state);
  const view = state.phase === "idle" ? shown : state;

  // Manba tumanning tirik sonlari: tanlashda so'raladi, jarayonda keshdagisi ko'rsatiladi.
  const usageSourceId = view.phase === "confirm" || view.phase === "progress" ? view.source.id : null;
  const usage = useDistrictUsage(usageSourceId, state.phase === "confirm");

  const closeAndRefresh = () => {
    close();
    refresh();
  };

  /** Sabab qatori → matn: sonlar `formatNumberLocalized`, tuman — oynadagi nom, tur — kichik harfli ko'plik. */
  const reasonText = (line: MergeReasonLine, source: MergeDistrict, target: MergeDistrict) => {
    const number = (value: number | undefined) =>
      formatNumberLocalized(value ?? 0, { language: i18n.language });
    const kindLower = line.kind
      ? t(`v2.districts.mergeError.kinds.${line.kind}`)
      : t("v2.districts.mergeError.kinds.any");
    const kindTitle = line.kind ? t(`v2.districts.rows.${line.kind}`) : t("v2.districts.mergeError.kinds.any");
    return t(`v2.districts.mergeError.reason.${line.key}`, {
      name: nameOf(line.district === "source" ? source : target),
      kind: line.key.startsWith("countMismatch") ? kindLower : kindTitle,
      expected: number(line.expected),
      actual: number(line.actual),
      seconds: number(line.seconds),
    });
  };

  let content: {
    role: "dialog" | "alertdialog";
    size: "md" | "lg";
    className?: string;
    props: Partial<DialogProps>;
    body: ReactNode;
    footer: ReactNode;
  } | null = null;

  if (view.phase === "confirm") {
    const { source, targetId } = view;
    const target = candidates.find((c) => c.id === targetId) ?? null;
    content = {
      role: "dialog",
      size: "lg",
      className: WIDTH_520,
      props: {
        title: t("v2.districts.merge.title"),
        description: presentation?.description
          ? presentation.description(source)
          : t("v2.districts.merge.text", { name: source.name }),
        icon: Merge,
      },
      body: (
        <>
          <div className="flex flex-col gap-2">
            <DistrictSummary
              label={t("v2.districts.merge.source")}
              title={presentation?.sourceTitle ? presentation.sourceTitle(source) : source.name}
              subtitle={presentation?.sourceSubtitle ? presentation.sourceSubtitle(source) : source.regionName}
              icon={presentation?.sourceIcon}
            />
            <span className="flex justify-center text-text-subtle" aria-hidden="true">
              <ArrowDown size={18} />
            </span>
            <Field
              label={t("v2.districts.merge.target")}
              required
              hint={
                candidates.length === 0
                  ? t("v2.districts.merge.noTargets")
                  : target
                    ? presentation?.targetHint
                      ? presentation.targetHint(source, target)
                      : t("v2.districts.merge.targetHint", { region: source.regionName })
                    : (
                        // merge-target: to'liq izoh `Info` belgisi bilan.
                        <span className="flex items-start gap-1.5">
                          <Info size={16} aria-hidden="true" className="mt-px shrink-0" />
                          <span className="min-w-0">
                            {t("v2.districts.merge.targetHintFull", {
                              region: source.regionName,
                              name: nameOf(source),
                            })}
                          </span>
                        </span>
                      )
              }
            >
              <Select
                searchable={presentation?.searchable ?? true}
                value={target?.id ?? null}
                placeholder={t("v2.districts.merge.targetPlaceholder")}
                options={candidates.map((c) => ({
                  value: c.id,
                  label: c.name,
                  group: c.regionName,
                  ...presentation?.option?.(c),
                }))}
                valueAddon={target && presentation?.valueAddon ? presentation.valueAddon(target) : undefined}
                onChange={(value) => select(value)}
                disabled={candidates.length === 0}
              />
            </Field>
          </div>
          {target ? (
            usage.isPending && usage.fetchStatus === "fetching" ? (
              <CountListSkeleton label={t("v2.districts.merge.countsLoading")} />
            ) : (
              <CountBlock
                title={
                  presentation?.movesTo
                    ? presentation.movesTo(target)
                    : t("v2.districts.merge.movesTo", { name: nameOf(target) })
                }
                counts={usage.data}
                label={t("v2.districts.merge.movesAria")}
              />
            )
          ) : null}
          {target ? (
            <MergeAlert tone="warning" icon={TriangleAlert} title={t("v2.districts.merge.irreversibleTitle")}>
              {presentation?.irreversibleText
                ? presentation.irreversibleText(source)
                : t("v2.districts.merge.irreversibleText", { name: source.name })}
            </MergeAlert>
          ) : null}
        </>
      ),
      footer: (
        <>
          <Button variant="secondary" onClick={close}>
            {t("v2.districts.merge.cancel")}
          </Button>
          <Button
            variant="danger"
            leftIcon={Merge}
            disabled={!target}
            onClick={() => {
              if (target) submit(target);
            }}
          >
            {t("v2.districts.merge.submit")}
          </Button>
        </>
      ),
    };
  } else if (view.phase === "progress") {
    const { source, target, startedAt } = view;
    content = {
      role: "alertdialog",
      size: "md",
      props: {
        "aria-labelledby": "district-merge-progress-title",
        "aria-describedby": "district-merge-progress-text",
        closable: false,
        dismissible: false,
        closeOnOverlay: false,
        busy: true,
        initialFocus: "panel",
      },
      body: (
        <>
          <div className="flex flex-col items-center gap-3 pt-2 text-center">
            <Spinner size="lg" className="text-action" label={t("v2.districts.progress.title")} />
            <h2 id="district-merge-progress-title" className="m-0 text-base font-bold text-text">
              {t("v2.districts.progress.title")}
            </h2>
            <p id="district-merge-progress-text" className="m-0 text-[13px] text-text-muted">
              {t("v2.districts.progress.text", { from: nameOf(source), to: nameOf(target) })}
            </p>
            <ElapsedBadge startedAt={startedAt} />
          </div>
          {hasCounts(usage.data) ? (
            <CountList counts={usage.data} label={t("v2.districts.progress.movingAria")} />
          ) : null}
          <MergeAlert tone="info" icon={Info} title={t("v2.districts.progress.keepOpenTitle")}>
            {t("v2.districts.progress.keepOpenText")}
          </MergeAlert>
        </>
      ),
      footer: (
        <Button
          variant="danger"
          loading
          loadingText={t("v2.districts.progress.title")}
          className="min-w-[200px]"
        >
          {t("v2.districts.progress.title")}
        </Button>
      ),
    };
  } else if (view.phase === "result") {
    const { source, target, outcome } = view;
    content = {
      role: "dialog",
      size: "md",
      props: {
        title: t("v2.districts.result.title"),
        description: t("v2.districts.result.text", { from: nameOf(source), to: nameOf(target) }),
        icon: CircleCheck,
        iconTone: "success",
        iconShape: "circle",
      },
      body: (
        <>
          <CountBlock
            title={t("v2.districts.result.moved")}
            counts={outcome.moved}
            label={t("v2.districts.result.moved")}
            surface="sunken"
            withHints={false}
          />
          {outcome.after ? (
            <TargetCounts name={nameOf(target)} before={outcome.before} after={outcome.after} />
          ) : null}
          <DialogNote>{t("v2.districts.result.note")}</DialogNote>
        </>
      ),
      footer: (
        <Button variant="primary" onClick={close}>
          {t("v2.districts.result.close")}
        </Button>
      ),
    };
  } else if (view.phase === "error" && view.details) {
    const { source, target, status, details } = view;
    const variant = mergeErrorVariant(status, details);
    const reasons = mergeReasonLines(details).map((line) => reasonText(line, source, target));
    const placeOf = (row: MergeStranded) =>
      row.districtId == null
        ? t("v2.districts.mergeError.strandedNowhere")
        : row.districtId === target.id
          ? t("v2.districts.mergeError.strandedIn", { name: nameOf(target) })
          : row.districtId === source.id
            ? t("v2.districts.mergeError.strandedIn", { name: nameOf(source) })
            : t("v2.districts.mergeError.strandedInId", { id: row.districtId });
    const title = t(`v2.districts.mergeError.title.${variant}`);
    // Z1c1sNPT: «{manba}ga qaytarildi» — faqat «chala qoldi» bo'lmagan oynalarda (maket `-error-manual` da yo'q).
    const rolledBack = variant !== "manual" && hasCounts(details.rolledBack) ? details.rolledBack : null;
    const copyReport = () => {
      const report = [
        title,
        `${source.name} (ID ${source.id}) → ${target.name} (ID ${target.id}) · ${source.regionName}`,
        ...reasons.map((line) => `${t("v2.districts.mergeError.reasonLabel")}: ${line}`),
        ...(rolledBack
          ? [
              `${t("v2.districts.mergeError.rolledBackTitle", { from: source.name })}: ${MERGE_KINDS.map(
                (kind) => `${t(`v2.districts.mergeError.kinds.${kind}`)} ${countTa(rolledBack[kind])}`,
              ).join(" · ")}`,
            ]
          : []),
        ...details.stranded.map(
          (row) =>
            `${t(`v2.districts.rows.${row.kind}`)}: ${row.count == null ? "?" : countTa(row.count)} — ${placeOf(row)}`,
        ),
        ...(details.strandedOrderIds.length
          ? [
              `${t("v2.districts.mergeError.strandedIdsLabel")}: ${details.strandedOrderIds
                .map((id) => t("v2.districts.mergeError.orderNumber", { id }))
                .join(", ")}`,
            ]
          : []),
        `${t("v2.districts.mergeError.copyCode")}: ${[details.reason ?? "—", details.kind].filter(Boolean).join(" · ")}`,
        details.traceId ? `trace_id: ${details.traceId}` : null,
        `${t("v2.districts.mergeError.copyTime")}: ${new Date().toISOString()}`,
      ]
        .filter(Boolean)
        .join("\n");
      void copyToClipboard(report).then((copied) => {
        if (copied) notify.success(t("v2.districts.mergeError.copied"));
        else notify.error(t("v2.districts.mergeError.copyFailed"));
      });
    };
    const note =
      variant === "manual"
        ? t("v2.districts.mergeError.note.manual", { name: source.name, id: source.id })
        : variant === "unavailable"
          ? t("v2.districts.mergeError.note.unavailable")
          : details.reason === "count_mismatch"
            ? t("v2.districts.mergeError.note.countMismatch")
            : t("v2.districts.mergeError.note.error");
    content = {
      role: "alertdialog",
      size: variant === "manual" ? "lg" : "md",
      className: variant === "manual" ? WIDTH_520 : undefined,
      props: {
        title,
        description: t(`v2.districts.mergeError.text.${variant}`, { from: nameOf(source) }),
        icon: CircleX,
        iconTone: "danger",
        iconShape: "circle",
      },
      body: (
        <>
          {variant === "manual" ? (
            <MergeAlert
              tone="danger"
              icon={TriangleAlert}
              role="alert"
              title={t("v2.districts.mergeError.manualTitle")}
            >
              {t("v2.districts.mergeError.manualText", { from: nameOf(source) })}
            </MergeAlert>
          ) : (
            <DistrictSummary title={`${nameOf(source)} → ${nameOf(target)}`} subtitle={source.regionName} />
          )}
          <ReasonBox lines={reasons} />
          {variant === "manual" ? (
            <StrandedList
              title={t("v2.districts.mergeError.strandedTitle", { from: nameOf(source) })}
              label={t("v2.districts.mergeError.strandedAria", { from: nameOf(source) })}
              rows={details.stranded}
              placeOf={placeOf}
              orderIds={details.strandedOrderIds}
            />
          ) : (
            // Z1c1sNPT (maket `merge-error`, `-error-unavailable`): «{manba}ga qaytarildi» — `details.rolled_back_*`;
            // nol qatorlar (boshlanmagan qadam) chizilmaydi, hammasi 0 bo'lsa — blok yo'q.
            <CountBlock
              title={t("v2.districts.mergeError.rolledBackTitle", { from: nameOf(source) })}
              label={t("v2.districts.mergeError.rolledBackAria", { from: nameOf(source) })}
              counts={rolledBack}
              withHints={false}
            />
          )}
          <DialogNote>{note}</DialogNote>
        </>
      ),
      footer: (
        <>
          <Button variant="secondary" leftIcon={Copy} onClick={copyReport}>
            {t("v2.districts.mergeError.copy")}
          </Button>
          {variant === "manual" ? (
            <Button
              variant="primary"
              leftIcon={ScrollText}
              onClick={() => {
                close();
                navigate(ACTIVITY_LOGS_PATH);
              }}
            >
              {t("v2.districts.mergeError.journal")}
            </Button>
          ) : (
            <Button variant="primary" leftIcon={RefreshCw} onClick={retry}>
              {t("v2.districts.mergeError.retry")}
            </Button>
          )}
        </>
      ),
    };
  } else if (view.phase === "unknown") {
    const { source, target } = view;
    content = {
      role: "alertdialog",
      size: "lg",
      className: WIDTH_520,
      props: {
        title: t("v2.districts.unknown.title"),
        description: t("v2.districts.unknown.text"),
        icon: CircleQuestionMark,
        iconShape: "circle",
      },
      body: (
        <>
          <DistrictSummary title={`${nameOf(source)} → ${nameOf(target)}`} subtitle={source.regionName} />
          <div className="flex flex-col gap-2">
            <Overline id="district-merge-check">{t("v2.districts.unknown.check")}</Overline>
            <ol
              aria-labelledby="district-merge-check"
              className="m-0 list-none rounded-xl border border-border px-3 py-0"
            >
              {[t("v2.districts.unknown.step1", { from: nameOf(source) }), t("v2.districts.unknown.step2", { from: nameOf(source) })].map(
                (step, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 border-b border-border py-3 last:border-b-0"
                  >
                    <Badge size="sm" className="shrink-0">
                      {index + 1}
                    </Badge>
                    <span className="min-w-0 flex-1 text-[13px] text-text">{step}</span>
                  </li>
                ),
              )}
            </ol>
          </div>
          <DialogNote>{t("v2.districts.unknown.note")}</DialogNote>
        </>
      ),
      footer: (
        <>
          <Button
            variant="secondary"
            leftIcon={ScrollText}
            onClick={() => {
              close();
              navigate(ACTIVITY_LOGS_PATH);
            }}
          >
            {t("v2.districts.unknown.journal")}
          </Button>
          <Button variant="primary" leftIcon={RefreshCw} onClick={closeAndRefresh}>
            {t("v2.districts.unknown.refresh")}
          </Button>
        </>
      ),
    };
  }

  if (!content) return null;

  return (
    <Dialog
      open={state.phase !== "idle" && !(state.phase === "error" && !state.details)}
      onClose={view.phase === "unknown" ? closeAndRefresh : close}
      role={content.role}
      size={content.size}
      className={content.className}
      footer={content.footer}
      returnFocus={returnFocus}
      {...content.props}
    >
      <span ref={anchorRef} hidden />
      {content.body}
    </Dialog>
  );
};

export default DistrictMergeDialog;
