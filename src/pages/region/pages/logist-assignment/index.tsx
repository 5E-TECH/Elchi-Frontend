// dizayn-v2: superadmin-regions-logist-assignment, admin-regions-logist-assignment, superadmin-regions-logist-assignment-confirm-dialog, admin-regions-logist-assignment-confirm-dialog, superadmin-regions-logist-assignment-empty, admin-regions-logist-assignment-empty
import { memo, useCallback, useEffect, useId, useMemo, useState } from "react";
import { Check, Info, TriangleAlert, UserPlus, Users } from "lucide-react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../../../app/config/store";
import {
  useBulkAssignRegionLogist,
  useLogistRegions,
  useLogists,
  useRefreshLogistAssignments,
  type Logist,
} from "../../../../entities/logist";
import { cx } from "../../../../shared/lib/cx";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import { notify } from "../../../../shared/lib/notify";
import {
  buttonClasses,
  ButtonIcon,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SegmentedControl,
  Skeleton,
  TONE_SOFT,
  useConfirm,
} from "../../../../shared/ui/primitives";
import { httpStatusOf } from "../../model/districtMerge";
import {
  assignedRegionIds,
  diffAssignment,
  filterRegions,
  matchesLogist,
  needsConfirmation,
  regionCountByLogist,
  resolveSelectedLogist,
  sortLogists,
  sortRegions,
  type RegionFilter,
} from "./model/assignment";
import { ChangesFooter, ChangesStickyBar } from "./ui/ChangesBar";
import { useConfirmDescription } from "./model/useAssignmentText";
import { ChangesList } from "./ui/ChangesList";
import { LogistListCard } from "./ui/LogistListCard";
import { LogistPicker } from "./ui/LogistPicker";
import { RegionChoiceCard } from "./ui/RegionChoiceCard";

/** Yangi logist yaratish — «Logist» roli tanlangan forma (LG-2). */
const CREATE_LOGIST_PATH = "/all-users/create-user?role=logist";

const EMPTY_IDS: ReadonlySet<string> = new Set();

type Draft = { logistId: string; ids: ReadonlySet<string> };

/** Saqlash xatosi → i18n matn (server matni ko'rsatilmaydi). 400 — logist nofaol (backend `resolveActiveLogist`). */
const SAVE_ERROR_KEY: Record<number, string> = {
  400: "v2.logist.saveError.inactive",
  403: "v2.logist.saveError.forbidden",
  404: "v2.logist.saveError.notFound",
};

/** «Logistlar yuklanmoqda» (maket «Boshqa holatlar»): avatar + ikki qator × 3. */
const LoadingCard = ({ label }: { label: string }) => (
  <Card padding="lg">
    <div role="status" aria-label={label} className="flex flex-col gap-4">
      {[70, 55, 62].map((width) => (
        <div key={width} className="flex items-center gap-3">
          <Skeleton shape="circle" width={40} height={40} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton width={`${width}%`} />
            <Skeleton width="45%" />
          </div>
        </div>
      ))}
    </div>
  </Card>
);

/**
 * LOGIST BIRIKTIRISH — `/regions/logist-assignment` (superadmin, admin; LG-2, dzyVftBx).
 *
 * Chapda logistlar (`GET /logists`: qidiruv, «N viloyat» / «Viloyatsiz» / «Nofaol»; telefonda — `Select`), o'ngda
 * 14 viloyat kartasi (`GET /region` → `logist_id`) va filtr «Barchasi · Belgilangan · Logistsiz». Belgilar —
 * saqlanmagan qoralama (6 holat, `model/assignment.ts`); pastda «N ta o'zgarish» (telefonda yopishqoq panel).
 * Saqlash — `POST /region/logist/bulk { logist_id, region_ids }`: faqat qo'shish bo'lsa darhol, olib tashlash yoki
 * boshqa logistdan o'tkazish bo'lsa — avval tasdiq oynasi (o'zgarishlar ro'yxati bilan). Saqlanmagan o'zgarish bor
 * paytda boshqa logist tanlansa — «O'zgarishlar saqlanmaydi» tasdig'i. Nofaol logist — ogohlantirish, kartalar va
 * «Saqlash» o'chiq (server 400 — zaxira). `?logist=<id>` — shu logist tanlangan holda ochiladi (yaratishdan keyin).
 * Logist yo'q — «Logist yo'q» + «Logist yaratish». Xabarlarda faqat i18n matn.
 */
const RegionLogistAssignmentPage = () => {
  const { t } = useTranslation("region");
  const role = useSelector((state: RootState) => state.role.role);
  const canAccess = role === "admin" || role === "superadmin";
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get("logist");
  const confirm = useConfirm();
  const confirmDescription = useConfirmDescription();
  const regionsTitleId = useId();

  const logistsQuery = useLogists({ enabled: canAccess });
  const regionsQuery = useLogistRegions({ enabled: canAccess });
  const saveMutation = useBulkAssignRegionLogist();
  const refresh = useRefreshLogistAssignments();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RegionFilter>("all");
  const [draft, setDraft] = useState<Draft | null>(null);

  const logists = useMemo(() => sortLogists(logistsQuery.data ?? []), [logistsQuery.data]);
  const regions = useMemo(() => sortRegions(regionsQuery.data ?? []), [regionsQuery.data]);
  const counts = useMemo(() => regionCountByLogist(regions), [regions]);
  const visibleLogists = useMemo(
    () => logists.filter((logist) => matchesLogist(logist, search)),
    [logists, search],
  );
  const nameById = useMemo(
    () => new Map(logists.map((logist) => [logist.id, logist.name])),
    [logists],
  );
  const ownerName = useCallback((logistId: string) => nameById.get(logistId) || null, [nameById]);

  // Qoralama bor paytda tanlov uning logistida qoladi (ro'yxat qayta kelib, tartib o'zgarsa ham).
  const pinnedId = draft?.logistId ?? requestedId;
  const selected = useMemo(() => resolveSelectedLogist(logists, pinnedId), [logists, pinnedId]);
  const selectedId = selected?.id ?? null;
  const hasDraft = draft !== null;

  // `?logist=` yo'q (yoki eskirgan) bo'lsa — birinchi marta tanlangan logist URL'ga yoziladi: keyin logist nofaol
  // bo'lib ro'yxat oxiriga tushsa ham, qayta ulanish yoki `refresh()` tanlovni boshqa logistga o'tkazmaydi.
  // `?logist=` dagi logist ro'yxatda hali yo'q, ro'yxat esa yangilanmoqda (masalan «Logist yaratish» dan keyin
  // keshdagi eski ro'yxat): URL yangi ro'yxatgacha tegilmaydi — aks holda yangi logist o'rniga birinchisi qolardi.
  const requestedPending =
    Boolean(requestedId) && logistsQuery.isFetching && !logists.some((logist) => logist.id === requestedId);
  useEffect(() => {
    if (!selectedId || selectedId === requestedId || hasDraft || requestedPending) return;
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("logist", selectedId);
        return next;
      },
      { replace: true },
    );
  }, [hasDraft, requestedId, requestedPending, selectedId, setSearchParams]);
  const serverIds = useMemo(
    () => (selectedId ? assignedRegionIds(regions, selectedId) : EMPTY_IDS),
    [regions, selectedId],
  );
  const checkedIds = draft && draft.logistId === selectedId ? draft.ids : serverIds;
  const diff = useMemo(
    () => diffAssignment(regions, selectedId ?? "", selectedId ? checkedIds : EMPTY_IDS),
    [checkedIds, regions, selectedId],
  );
  const locked = selected?.status === "inactive";
  const saving = saveMutation.isPending;
  const visibleRegions = useMemo(
    () => filterRegions(regions, filter, checkedIds),
    [checkedIds, filter, regions],
  );
  const freeCount = useMemo(() => regions.filter((region) => !region.logistId).length, [regions]);

  if (!canAccess) {
    return <Navigate to="/regions" replace />;
  }

  const toggleRegion = (regionId: string) => {
    if (!selectedId || locked || saving) return;
    const next = new Set(checkedIds);
    if (next.has(regionId)) next.delete(regionId);
    else next.add(regionId);
    setDraft({ logistId: selectedId, ids: next });
  };

  const selectLogist = async (logist: Logist) => {
    if (!selected || logist.id === selected.id || saving) return;
    if (diff.total > 0) {
      const leave = await confirm({
        title: t("v2.logist.leave.title"),
        description: t("v2.logist.leave.description", {
          name: selected.name,
          count: diff.total,
          next: logist.name,
        }),
        confirmLabel: t("v2.logist.leave.confirm"),
        cancelLabel: t("v2.logist.leave.stay"),
        icon: TriangleAlert,
        iconTone: "warning",
      });
      if (!leave) return;
    }
    setDraft(null);
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("logist", logist.id);
        return next;
      },
      { replace: true },
    );
  };

  const save = async () => {
    if (!selected || diff.total === 0 || locked || saving) return;
    if (needsConfirmation(diff)) {
      const accepted = await confirm({
        title: t("v2.logist.confirm.title"),
        description: confirmDescription(selected.name, diff),
        confirmLabel: t("v2.logist.confirm.confirm"),
        confirmIcon: Check,
        icon: TriangleAlert,
        iconTone: "warning",
        size: "md",
        // Ro'yxat, so'ng izoh (maket tartibi; `note` prop'i `children` dan oldin chiziladi).
        children: <ChangesList diff={diff} ownerName={ownerName} />,
      });
      if (!accepted) return;
    }
    const regionIds = regions
      .filter((region) => checkedIds.has(region.id))
      .map((region) => region.id);
    try {
      await saveMutation.mutateAsync({ logist_id: selected.id, region_ids: regionIds });
      setDraft(null);
      notify.success(t("v2.logist.saved.title"), {
        description: t("v2.logist.saved.description", {
          name: selected.name,
          count: regionIds.length,
        }),
      });
    } catch (error) {
      const status = httpStatusOf(error);
      notify.error(t("v2.logist.saveError.title"), {
        description: t((status && SAVE_ERROR_KEY[status]) || "v2.logist.saveError.generic"),
      });
      // Logist nofaol bo'lib qolgan yoki o'chirilgan bo'lishi mumkin — ro'yxatlar yangilanadi, qoralama qoladi.
      if (status === 400 || status === 404) void refresh();
    }
  };

  const loading = logistsQuery.isPending || regionsQuery.isPending;
  // Faqat ma'lumot umuman kelmagan bo'lsa: fondagi qayta so'rov xatosi (saqlashdan keyin, qayta ulanishda) qoralama va
  // keshdagi holatni xato ekrani bilan almashtirmaydi.
  const logistsFailed = logistsQuery.isError && logistsQuery.data === undefined;
  const regionsFailed = regionsQuery.isError && regionsQuery.data === undefined;
  const failed = logistsFailed || regionsFailed;
  const empty = !loading && !failed && logists.length === 0;

  const header = (
    <PageHeader
      back="/regions"
      backLabel={t("v2.page.title")}
      title={t("v2.logist.title")}
      description={t("v2.logist.subtitle")}
      actions={
        empty ? undefined : (
          <Link to={CREATE_LOGIST_PATH} className={buttonClasses({ variant: "secondary" })}>
            <ButtonIcon icon={UserPlus} px={18} />
            {t("v2.logist.create")}
          </Link>
        )
      }
    />
  );

  if (failed) {
    const retry = () => {
      if (logistsFailed) void logistsQuery.refetch();
      if (regionsFailed) void regionsQuery.refetch();
    };
    return (
      <div className="flex flex-col gap-6 max-md:gap-4">
        {header}
        <Card padding="none">
          <ErrorState
            error={logistsFailed ? logistsQuery.error : regionsQuery.error}
            title={t(logistsFailed ? "v2.logist.error.logists" : "v2.logist.error.regions")}
            description={t("v2.logist.error.text")}
            onRetry={retry}
            retrying={logistsQuery.isFetching || regionsQuery.isFetching}
          />
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 max-md:gap-4">
        {header}
        <LoadingCard label={t("v2.logist.loading")} />
      </div>
    );
  }

  if (empty || !selected) {
    return (
      <div className="flex flex-col gap-6 max-md:gap-4">
        {header}
        <EmptyState
          framed
          icon={Users}
          title={t("v2.logist.empty.title")}
          description={t("v2.logist.empty.text")}
          action={
            <Link to={CREATE_LOGIST_PATH} className={buttonClasses({ variant: "primary" })}>
              <ButtonIcon icon={UserPlus} px={18} />
              {t("v2.logist.create")}
            </Link>
          }
        />
      </div>
    );
  }

  const phone = formatPhone(selected.phone_number);
  const summary = t("v2.logist.regions.checkedOf", {
    total: regions.length,
    checked: checkedIds.size,
  });
  const barProps = {
    diff,
    saving,
    locked,
    onCancel: () => setDraft(null),
    onSave: () => void save(),
  };

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      {header}

      <div className="flex flex-wrap items-start gap-6 max-md:gap-4">
        <LogistListCard
          logists={visibleLogists}
          total={logists.length}
          counts={counts}
          selectedId={selectedId}
          onSelect={(logist) => void selectLogist(logist)}
          search={search}
          onSearchChange={setSearch}
          className="flex-[1_1_300px] max-md:hidden"
        />
        <LogistPicker
          logists={logists}
          counts={counts}
          selectedId={selectedId}
          onSelect={(logist) => void selectLogist(logist)}
          className="w-full md:hidden"
        />

        <Card
          as="section"
          padding="none"
          aria-labelledby={regionsTitleId}
          className="min-w-0 flex-[2_1_560px]"
        >
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border px-5 py-4 max-md:px-4">
            <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
              <h2 id={regionsTitleId} className="text-base font-bold text-text">
                {t("v2.logist.regions.title", { name: selected.name })}
              </h2>
              <p className="text-[13px] leading-[18px] text-text-muted">
                {phone && phone !== "—" ? `${phone} · ${summary}` : summary}
              </p>
            </div>
            <SegmentedControl
              ariaLabel={t("v2.logist.regions.filterLabel")}
              value={filter}
              onValueChange={setFilter}
              // Telefonda segmentlar matn eniga qarab (teng emas): «Barchasi · 14» qisqa, «Belgilangan · 14» /
              // «Свободные · 14» uzun — teng `flex-1` da ~88 px ga sig'maydi va son «…» ostida qolardi.
              className="max-w-full max-md:[&>button]:flex-auto"
              options={[
                {
                  value: "all",
                  label: t("v2.logist.regions.filter.all", { count: regions.length }),
                },
                {
                  value: "checked",
                  label: t("v2.logist.regions.filter.checked", { count: checkedIds.size }),
                },
                { value: "free", label: t("v2.logist.regions.filter.free", { count: freeCount }) },
              ]}
            />
          </div>

          <div className="flex flex-col gap-3 p-5 max-md:p-4">
            {locked ? (
              <div
                role="status"
                className={cx(
                  "flex items-start gap-3 rounded-xl px-4 py-3 text-sm",
                  TONE_SOFT.warning,
                )}
              >
                <TriangleAlert size={18} aria-hidden="true" className="mt-px shrink-0" />
                <div className="flex min-w-0 flex-col gap-0.5 text-text">
                  <span className="font-bold">
                    {t("v2.logist.inactive.title", { name: selected.name })}
                  </span>
                  <span className="text-[13px] text-text-muted">
                    {t("v2.logist.inactive.text")}
                  </span>
                </div>
              </div>
            ) : null}
            {visibleRegions.length === 0 ? (
              <EmptyState size="inline" title={t("v2.logist.regions.filteredEmpty")} />
            ) : (
              <fieldset className="m-0 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(250px,100%),1fr))] gap-2 border-0 p-0">
                <legend className="sr-only">
                  {t("v2.logist.regions.legend", { name: selected.name })}
                </legend>
                {visibleRegions.map((region) => (
                  <RegionChoiceCard
                    key={region.id}
                    region={region}
                    logistId={selected.id}
                    checked={checkedIds.has(region.id)}
                    ownerName={ownerName}
                    disabled={locked || saving}
                    onToggle={toggleRegion}
                  />
                ))}
              </fieldset>
            )}
            <p className="m-0 flex items-start gap-2 text-xs text-text-muted">
              <Info size={14} aria-hidden="true" className="mt-px shrink-0" />
              <span>{t("v2.logist.regions.note")}</span>
            </p>
          </div>

          <ChangesFooter {...barProps} />
        </Card>
      </div>

      <ChangesStickyBar {...barProps} />
    </div>
  );
};

export default memo(RegionLogistAssignmentPage);
