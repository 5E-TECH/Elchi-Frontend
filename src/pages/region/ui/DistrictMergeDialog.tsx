// dizayn-v2: superadmin-regions-districts-merge-dialog, superadmin-regions-districts-merge-target, superadmin-regions-districts-merge-progress, superadmin-regions-districts-merge-result, superadmin-regions-districts-merge-unknown, admin-regions-districts-merge-dialog, admin-regions-districts-merge-target, admin-regions-districts-merge-progress, admin-regions-districts-merge-result, admin-regions-districts-merge-unknown, superadmin-regions-sato-codes-merge-dialog
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  Building2,
  CircleCheck,
  CircleQuestionMark,
  Clock,
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
import { useNavigate } from "react-router-dom";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  Dialog,
  Field,
  Select,
  Spinner,
  TONE_SOFT,
  type DialogProps,
  type SelectOption,
} from "../../../shared/ui/primitives";
import {
  formatElapsed,
  type MergeCounts,
  type MergeDistrict,
  type MergeState,
} from "../model/districtMerge";
import { ACTIVITY_LOGS_PATH, type DistrictMergeController } from "./useDistrictMerge";

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
}: {
  tone: "warning" | "info";
  icon: LucideIcon;
  title: ReactNode;
  children: ReactNode;
}) => (
  <div role="note" className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT[tone])}>
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

const ROWS: ReadonlyArray<{ key: keyof MergeCounts; icon: LucideIcon }> = [
  { key: "orders", icon: ShoppingBag },
  { key: "users", icon: Users },
  { key: "branches", icon: Building2 },
];

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
  const { t, i18n } = useTranslation("region");
  const countTa = (value: number) =>
    t("v2.common.countTa", { count: formatNumberLocalized(value, { language: i18n.language }) });
  const label = t("v2.districts.result.nowIn", { name });
  return (
    <div className="flex flex-col gap-2">
      <Overline>{label}</Overline>
      <ul aria-label={label} className="m-0 list-none rounded-xl bg-sunken px-3 py-0">
        {ROWS.map(({ key, icon: Icon }) => (
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
        ))}
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
 * natija (`merge-result`) yoki noma'lum (`merge-unknown`, «Qayta urinish» yo'q).
 * Sonlar bloklari («Bog'langan», «… ko'chadi», «Ko'chirildi») va xato oynalari — backend N1 dan keyin (DM-2);
 * jurnal yozuvi nomlari — DM-3.
 */
const DistrictMergeDialog = ({ merge, candidates, returnFocus, presentation }: DistrictMergeDialogProps) => {
  const { t } = useTranslation("region");
  const nameOf = (district: MergeDistrict) => presentation?.displayName?.(district) ?? district.name;
  const navigate = useNavigate();
  const { state, select, submit, close, refresh } = merge;
  const inProgress = state.phase === "progress";

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

  const closeAndRefresh = () => {
    close();
    refresh();
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
      open={state.phase !== "idle" && state.phase !== "error"}
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
