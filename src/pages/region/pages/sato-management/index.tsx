// dizayn-v2: superadmin-regions-sato-management, admin-regions-sato-management, superadmin-regions-sato-codes, superadmin-regions-sato-codes-not-found, superadmin-regions-sato-codes-edit, admin-regions-sato-codes, admin-regions-sato-codes-edit, superadmin-regions-sato-codes-apply-dialog, superadmin-regions-sato-codes-duplicates, superadmin-regions-sato-codes-merge-dialog, superadmin-regions-sato-codes-missing, superadmin-regions-sato-codes-add-dialog
import { memo, useCallback, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RootState } from "../../../../app/config/store";
import { api } from "../../../../shared/api/api";
import { API_ENDPOINTS } from "../../../../shared/api";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { notify } from "../../../../shared/lib/notify";
import {
  Badge,
  ErrorState,
  PageHeader,
  SkeletonList,
  Tabs,
  TextInput,
  getPanelId,
  getTabId,
} from "../../../../shared/ui/primitives";
import DistrictBoard from "../../ui/DistrictBoard";
import { filterBoardRegions, normalizeBoardRegions, type BoardRegionItem } from "../../model/boardModel";
import {
  buildAdminSatoView,
  buildSuperadminSatoView,
  normalizeSatoDistricts,
  normalizeSatoPreview,
  satoRegionOptions,
  type SatoDistrict,
  type SatoTabRows,
} from "../../model/satoModel";
import { SatoApplyAction } from "../../ui/sato/SatoApplyDialog";
import { SatoCodesPanel } from "../../ui/sato/SatoCodesPanel";
import { SatoKpiRow } from "../../ui/sato/SatoKpiRow";

const REGIONS_KEY = ["regions", "with-districts"];
/** SATO tabi: preview (superadmin) va `/district` — har doim BIRGA qayta yuklanadi (bitta prefiks). */
const SATO_KEY = ["district-sato"] as const;
const SATO_DISTRICTS_KEY = [...SATO_KEY, "districts"] as const;
const SATO_PREVIEW_KEY = [...SATO_KEY, "preview"] as const;
/**
 * Tuman qo'shilsa, birlashtirilsa (SA-2) yoki boshqa viloyatga o'tkazilsa (kGvjztpY) eskiradigan boshqa keshlar:
 * o'tkazish taxtasi, tumanlar sahifasi (DM-1), tuman tanlagichlari va viloyat statistikasi.
 */
const DISTRICT_DEPENDENT_KEYS = [REGIONS_KEY, ["region-districts-admin"], ["region-district-catalog"], ["region-stats"]];

type PageTab = "move" | "sato";
const PAGE_TABS: readonly PageTab[] = ["move", "sato"];
const PAGE_TABS_ID = "sato-page";

const useRegionsQuery = (enabled: boolean) =>
  useQuery({
    queryKey: REGIONS_KEY,
    queryFn: () =>
      api.get(API_ENDPOINTS.REGIONS.BASE).then((res) => normalizeBoardRegions(res.data)),
    enabled,
    refetchOnWindowFocus: false,
    // Xato sahifada (`ErrorState` + «Qayta urinish») — global xabar takrorlanmaydi.
    meta: { silentError: true },
  });

/**
 * TUMANLARNI O'TKAZISH (sukut tab): tumanni sudrab boshqa viloyatga tashlash (telefonda «⇆» → viloyat tanlash
 * oynasi). PATCH `district/:id {assigned_region}` — optimistik; muvaffaqiyatda doska va bog'liq keshlar qayta
 * yuklanadi, xato bo'lsa xabar va ro'yxat serverdan qayta yuklanadi (tuman joyida qoladi).
 */
const MoveDistrictsTab = ({ regionsQuery }: { regionsQuery: ReturnType<typeof useRegionsQuery> }) => {
  const { t } = useTranslation("region");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);
  const regions = useMemo(() => regionsQuery.data ?? [], [regionsQuery.data]);
  const filteredRegions = useMemo(() => filterBoardRegions(regions, search), [regions, search]);

  const moveDistrictOptimistic = (districtId: string, fromRegionId: string, toRegionId: string) => {
    queryClient.setQueryData<BoardRegionItem[]>(REGIONS_KEY, (current) => {
      if (!current) return current;
      const district = current
        .find((r) => r.id === fromRegionId)
        ?.districts.find((d) => d.id === districtId);
      if (!district) return current;
      return current.map((region) => {
        if (region.id === fromRegionId)
          return { ...region, districts: region.districts.filter((d) => d.id !== districtId) };
        if (region.id === toRegionId)
          return {
            ...region,
            districts: [...region.districts, district],
          };
        return region;
      });
    });
  };

  const handleMove = async (districtId: string, fromRegionId: string, toRegionId: string) => {
    if (!districtId || !fromRegionId || !toRegionId || fromRegionId === toRegionId) return;

    setMovingId(districtId);
    // Oldingi o'tkazishdan keyingi qayta yuklash optimistik holatni eski ro'yxat bilan bosib ketmasin.
    await queryClient.cancelQueries({ queryKey: REGIONS_KEY });
    moveDistrictOptimistic(districtId, fromRegionId, toRegionId);

    try {
      await api.patch(API_ENDPOINTS.DISTRICTS.BY_ID(districtId), { assigned_region: toRegionId });
      notify.success(t("sato.moveSuccess"));
      // Ko'chirilgan tuman boshqa ekranlarda ham yangi viloyatida: doska (`assignedDistricts`), tumanlar sahifasi,
      // tuman tanlagichlari va statistika. SATO tabi o'zgarmaydi (prefiks — geografik viloyat bo'yicha).
      void Promise.all(
        DISTRICT_DEPENDENT_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    } catch {
      notify.error(t("sato.moveError"), { description: t("v2.sato.moveErrorText") });
      await regionsQuery.refetch();
    } finally {
      setMovingId(null);
    }
  };

  return (
    <>
      <p className="m-0 flex items-start gap-2 text-[13px] leading-[18px] text-text-muted">
        <Info size={16} aria-hidden="true" className="mt-px shrink-0" />
        <span className="min-w-0">{t("v2.sato.moveInfo")}</span>
      </p>

      <TextInput
        mode="search"
        value={search}
        onValueChange={setSearch}
        aria-label={t("v2.board.searchAria")}
        placeholder={t("sato.searchPlaceholder")}
        className="w-full max-w-[520px] max-md:max-w-none"
      />

      {regionsQuery.isError && !regionsQuery.data ? (
        <ErrorState
          framed
          error={regionsQuery.error}
          title={t("v2.board.loadError")}
          onRetry={() => void regionsQuery.refetch()}
          retrying={regionsQuery.isFetching}
        />
      ) : !regionsQuery.data ? (
        <SkeletonList />
      ) : (
        <DistrictBoard
          regions={filteredRegions}
          allRegions={regions}
          movingId={movingId}
          moveHint
          expandAll={search.trim().length > 0}
          onMove={(districtId, fromRegionId, toRegionId) =>
            void handleMove(districtId, fromRegionId, toRegionId)
          }
        />
      )}
    </>
  );
};

/**
 * SATO KODLARI ma'lumoti (sahifa darajasida — sarlavhadagi «SATO kodlarini yozish N» ham shuni o'qiydi).
 * Superadmin: preview (`GET district/sato-match/preview`) + `GET district` (`dbId = id`). Admin: preview
 * chaqirilmaydi (403) — faqat `GET district`. Kod saqlangach ikkala so'rov birga qayta yuklanadi.
 */
const useSatoCodesData = (superadmin: boolean, enabled: boolean) => {
  const queryClient = useQueryClient();

  const districtsQuery = useQuery({
    queryKey: SATO_DISTRICTS_KEY,
    queryFn: () => api.get(API_ENDPOINTS.DISTRICTS.BASE).then((res) => normalizeSatoDistricts(res.data)),
    enabled,
    refetchOnWindowFocus: false,
    meta: { silentError: true },
  });
  const previewQuery = useQuery({
    queryKey: SATO_PREVIEW_KEY,
    queryFn: () =>
      api.get(API_ENDPOINTS.DISTRICTS.SATO_MATCH_PREVIEW).then((res) => normalizeSatoPreview(res.data)),
    enabled: enabled && superadmin,
    refetchOnWindowFocus: false,
    meta: { silentError: true },
  });

  const districts = districtsQuery.data;
  const preview = superadmin ? previewQuery.data : undefined;

  const view = useMemo(() => {
    if (!districts) return null;
    if (!superadmin) return { rows: buildAdminSatoView(districts) as SatoTabRows, duplicateGroups: 0 };
    if (!preview) return null;
    const built = buildSuperadminSatoView(preview, districts);
    return { rows: built.rows as SatoTabRows, duplicateGroups: built.duplicateGroups };
  }, [districts, preview, superadmin]);
  const regionOptions = useMemo(() => satoRegionOptions(districts ?? []), [districts]);

  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: SATO_KEY }), [queryClient]);
  /** Tuman qo'shildi / birlashtirildi: SATO so'rovlari va bog'liq keshlar. */
  const refreshAll = useCallback(
    () =>
      Promise.all(
        [SATO_KEY, ...DISTRICT_DEPENDENT_KEYS].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
    [queryClient],
  );
  /** Qayta yuklab, yangi `/district` ni qaytaradi (yozish natijasi — haqiqiy holat); yuklanmasa `null`. */
  const reload = useCallback(async (): Promise<SatoDistrict[] | null> => {
    const startedAt = Date.now();
    await queryClient.invalidateQueries({ queryKey: SATO_KEY });
    const state = queryClient.getQueryState<SatoDistrict[]>(SATO_DISTRICTS_KEY);
    return state?.status === "success" && state.dataUpdatedAt >= startedAt ? (state.data ?? null) : null;
  }, [queryClient]);
  const queries = superadmin ? [districtsQuery, previewQuery] : [districtsQuery];
  const failed = queries.find((query) => query.isError && !query.data);

  return { districts, preview, view, regionOptions, refresh, refreshAll, reload, queries, failed };
};

type SatoCodesData = ReturnType<typeof useSatoCodesData>;

/** SATO KODLARI tabi: superadmin — KPI qatori va 5 ta holat tabi; admin — «Kodsiz» va «Kodi bor». */
const SatoCodesTab = ({ superadmin, data }: { superadmin: boolean; data: SatoCodesData }) => {
  const { districts, preview, view, regionOptions, refresh, refreshAll, queries, failed } = data;

  return (
    <>
      {superadmin && !failed ? (
        <SatoKpiRow
          stats={view && preview ? preview.stats : null}
          withCode={view?.rows.hasCode?.length ?? 0}
          duplicateGroups={view?.duplicateGroups ?? 0}
        />
      ) : null}
      <SatoCodesPanel
        variant={superadmin ? "superadmin" : "admin"}
        rows={view?.rows ?? null}
        duplicateGroups={view?.duplicateGroups}
        regionOptions={regionOptions}
        query={{
          isLoading: !view && !failed,
          isError: Boolean(failed),
          error: failed?.error,
          isFetching: queries.some((query) => query.isFetching),
          refetch: () => Promise.all(queries.map((query) => query.refetch())),
        }}
        onSaved={refresh}
        districts={superadmin ? districts : undefined}
        onChanged={superadmin ? refreshAll : undefined}
      />
    </>
  );
};

/**
 * TUMANLAR VA SATO KODLARI (superadmin, admin — ega S1): bitta sarlavha va ikki tab — «Tumanlarni o'tkazish»
 * (sukut) va «SATO kodlari» (`?tab=sato`). Tab almashsa sarlavha amallari ham almashadi: o'tkazishda — viloyat va
 * tuman sonlari, SATO'da — superadminga «SATO kodlarini yozish N» (SA-2; adminda amal yo'q).
 */
const RegionSatoManagementPage = () => {
  const { t, i18n } = useTranslation("region");
  const role = useSelector((state: RootState) => state.role.role);
  const canAccess = role === "superadmin" || role === "admin";
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: PageTab = searchParams.get("tab") === "sato" ? "sato" : "move";

  const regionsQuery = useRegionsQuery(canAccess && tab === "move");
  const superadmin = role === "superadmin";
  const satoData = useSatoCodesData(superadmin, canAccess && tab === "sato");
  const regions = regionsQuery.data ?? [];
  const totalDistricts = regions.reduce((sum, region) => sum + region.districts.length, 0);

  if (!canAccess) {
    return <Navigate to="/regions" replace />;
  }

  const number = (value: number) => formatNumberLocalized(value, { language: i18n.language });
  const selectTab = (next: PageTab) => {
    if (next === tab) return;
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (next === "sato") params.set("tab", "sato");
        else params.delete("tab");
        return params;
      },
      { replace: true },
    );
  };

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        back="/regions"
        backLabel={t("v2.page.title")}
        title={t("v2.sato.title")}
        description={t("v2.sato.subtitle")}
        actions={
          tab === "move" ? (
            <div role="group" aria-label={t("v2.board.countsAria")} className="flex flex-wrap gap-2">
              <Badge>
                {t("v2.board.regionsCount")}{" "}
                <span className="font-bold">{number(regions.length)}</span>
              </Badge>
              <Badge>
                {t("v2.board.districtsCount")}{" "}
                <span className="font-bold">{number(totalDistricts)}</span>
              </Badge>
            </div>
          ) : superadmin ? (
            <SatoApplyAction rows={satoData.failed ? null : (satoData.view?.rows ?? null)} reload={satoData.reload} />
          ) : undefined
        }
      >
        <Tabs<PageTab>
          items={PAGE_TABS.map((value) => ({ value, label: t(`v2.sato.pageTabs.${value}`) }))}
          value={tab}
          onValueChange={selectTab}
          ariaLabel={t("v2.sato.pageTabsAria")}
          idPrefix={PAGE_TABS_ID}
          controlsPanel
          background="bg"
        />
      </PageHeader>

      <div
        role="tabpanel"
        id={getPanelId(PAGE_TABS_ID, tab)}
        aria-labelledby={getTabId(PAGE_TABS_ID, tab)}
        className="flex min-w-0 flex-col gap-6 max-md:gap-4"
      >
        {tab === "move" ? (
          <MoveDistrictsTab regionsQuery={regionsQuery} />
        ) : (
          <SatoCodesTab superadmin={superadmin} data={satoData} />
        )}
      </div>
    </div>
  );
};

export default memo(RegionSatoManagementPage);
