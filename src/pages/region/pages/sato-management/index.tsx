// dizayn-v2: superadmin-regions-sato-management, admin-regions-sato-management
import { memo, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
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
  TextInput,
} from "../../../../shared/ui/primitives";
import DistrictBoard from "../../ui/DistrictBoard";
import { filterBoardRegions } from "../../model/boardModel";

type District = {
  id: string;
  name: string;
  region_id: string;
};

type Region = {
  id: string;
  name: string;
  districts: District[];
};

const toArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value : []);

/** GET /region → viloyatlar va biriktirilgan tumanlar (`assignedDistricts`, bo'lmasa `districts`). */
const normalizeSatoRegions = (payload: unknown): Region[] => {
  const source = payload as
    { data?: unknown[] | { data?: unknown[]; items?: unknown[] } } | undefined;

  const raw = Array.isArray(source?.data)
    ? source.data
    : Array.isArray((source?.data as { data?: unknown[] })?.data)
      ? (source?.data as { data: unknown[] }).data
      : Array.isArray((source?.data as { items?: unknown[] })?.items)
        ? (source?.data as { items: unknown[] }).items
        : [];

  return raw.map((item) => {
    const region = item as {
      id?: string | number;
      name?: string;
      assignedDistricts?: unknown[];
      districts?: unknown[];
    };

    const districtsRaw = Array.isArray(region.assignedDistricts)
      ? region.assignedDistricts
      : toArray(region.districts);

    const districts = districtsRaw.map((district) => {
      const d = district as { id?: string | number; name?: string; region_id?: string | number };
      return {
        id: String(d.id ?? ""),
        name: d.name ?? "—",
        region_id: String(d.region_id ?? region.id ?? ""),
      };
    });

    return {
      id: String(region.id ?? ""),
      name: region.name ?? "—",
      districts: districts.filter((d) => d.id),
    };
  });
};

const REGIONS_KEY = ["regions", "with-districts"];

/**
 * TUMANLARNI O'TKAZISH (superadmin, admin): tumanni sudrab boshqa viloyatga tashlash (telefonda «⇆» →
 * viloyat tanlash oynasi). PATCH `district/:id {assigned_region}` — optimistik; xato bo'lsa xabar va
 * ro'yxat serverdan qayta yuklanadi (tuman joyida qoladi).
 */
const RegionSatoManagementPage = () => {
  const { t, i18n } = useTranslation("region");
  const role = useSelector((state: RootState) => state.role.role);
  const canAccess = role === "superadmin" || role === "admin";
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);

  const regionsQuery = useQuery({
    queryKey: REGIONS_KEY,
    queryFn: () =>
      api.get(API_ENDPOINTS.REGIONS.BASE).then((res) => normalizeSatoRegions(res.data)),
    enabled: canAccess,
    refetchOnWindowFocus: false,
    // Xato sahifada (`ErrorState` + «Qayta urinish») — global xabar takrorlanmaydi.
    meta: { silentError: true },
  });
  const regions = useMemo(() => regionsQuery.data ?? [], [regionsQuery.data]);
  const totalDistricts = regions.reduce((sum, region) => sum + region.districts.length, 0);
  const filteredRegions = useMemo(() => filterBoardRegions(regions, search), [regions, search]);

  const moveDistrictOptimistic = (districtId: string, fromRegionId: string, toRegionId: string) => {
    queryClient.setQueryData<Region[]>(REGIONS_KEY, (current) => {
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
            districts: [...region.districts, { ...district, region_id: toRegionId }],
          };
        return region;
      });
    });
  };

  const handleMove = async (districtId: string, fromRegionId: string, toRegionId: string) => {
    if (!districtId || !fromRegionId || !toRegionId || fromRegionId === toRegionId) return;

    setMovingId(districtId);
    moveDistrictOptimistic(districtId, fromRegionId, toRegionId);

    try {
      await api.patch(API_ENDPOINTS.DISTRICTS.BY_ID(districtId), { assigned_region: toRegionId });
      notify.success(t("sato.moveSuccess"));
    } catch {
      notify.error(t("sato.moveError"), { description: t("v2.sato.moveErrorText") });
      await regionsQuery.refetch();
    } finally {
      setMovingId(null);
    }
  };

  if (!canAccess) {
    return <Navigate to="/regions" replace />;
  }

  const number = (value: number) => formatNumberLocalized(value, { language: i18n.language });

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        back="/regions"
        backLabel={t("v2.page.title")}
        title={t("v2.sato.title")}
        description={t("v2.sato.subtitle")}
        actions={
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
        }
      />

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
    </div>
  );
};

export default memo(RegionSatoManagementPage);
