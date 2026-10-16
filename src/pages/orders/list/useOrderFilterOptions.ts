import { useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { useBranches } from "../../../entities/branch";
import { useLogistics } from "../../../entities/logistics/api/logisticsApi";
import { useMarkets } from "../../../entities/markets";
import { useUser } from "../../../entities/user/api/userApi";

export type FilterOption = { value: string; label: string };

type Named = { id: string | number; name: string };

/** API javobidan ro'yxat: massiv, `{ data: { items } }` yoki `{ items }`. */
const toItems = (value: unknown): Named[] => {
  if (Array.isArray(value)) return value as Named[];
  if (typeof value === "object" && value !== null) {
    const record = value as { data?: { items?: unknown }; items?: unknown };
    if (Array.isArray(record.data?.items)) return record.data.items as Named[];
    if (Array.isArray(record.items)) return record.items as Named[];
  }
  return [];
};

const toOptions = (items: Named[]): FilterOption[] => items.map((item) => ({ value: String(item.id), label: item.name }));

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

/** Menejer filialining viloyati (profil yoki Redux foydalanuvchisi): kuryer va tuman ro'yxatlari shu viloyat bo'yicha. */
const readManagerRegionId = (source: Record<string, unknown> | null): string => {
  if (!source) return "";
  const branch = asRecord(source.branch);
  const nestedBranch = asRecord(branch?.branch);
  const raw =
    nestedBranch?.region_id ??
    nestedBranch?.regionId ??
    asRecord(nestedBranch?.region)?.id ??
    branch?.region_id ??
    branch?.regionId ??
    asRecord(branch?.region)?.id;
  if (typeof raw === "string" && raw.trim()) return raw;
  if (typeof raw === "number") return String(raw);
  return "";
};

/**
 * Buyurtmalar filtri variantlari (market, filial, viloyat, tuman, kuryer) — rolga qarab faqat kerakli so'rovlar.
 * Asboblar qatori va telefon varaqasi ikkalasi shu hook'ni chaqiradi (so'rovlar kalit bo'yicha bitta).
 *
 * @param courierRegionId kuryerlar qaysi viloyat bo'yicha (menejerda — filial viloyati, o'zi aniqlanadi).
 */
export const useOrderFilterOptions = (role: string | null, courierRegionId: string) => {
  const currentUser = useSelector((state: RootState) => state.user.user as Record<string, unknown> | null);
  const isMarketRole = role === "market";
  const isManagerRole = role === "manager";
  const canUseBranchFilter = role === "admin" || role === "superadmin";
  const canLoadRoleDependentOptions = role !== null && !isMarketRole;

  const { useGetRegions, useGetCouriers, useGetMyProfile } = useUser();
  const { useGetDistricts } = useLogistics();
  const { useGetMarkets } = useMarkets();

  const marketsQuery = useGetMarkets({ status: "active", limit: 100 }, canLoadRoleDependentOptions);
  const branchesQuery = useBranches({ status: "active", limit: 100, page: 1 }, canUseBranchFilter);
  const { data: myProfileData } = useGetMyProfile();

  const managerRegionId = useMemo(() => {
    if (!isManagerRole) return "";
    const profileUser = asRecord(asRecord(myProfileData)?.data);
    return readManagerRegionId(profileUser ?? currentUser);
  }, [currentUser, isManagerRole, myProfileData]);

  const regionForCouriers = isManagerRole ? managerRegionId : courierRegionId;
  const couriersQuery = useGetCouriers(
    {
      status: "active",
      limit: 100,
      ...(regionForCouriers ? { region_id: regionForCouriers } : {}),
    },
    canLoadRoleDependentOptions && (!isManagerRole || Boolean(managerRegionId)),
  );
  const regionsQuery = useGetRegions(!isManagerRole);
  const districtsQuery = useGetDistricts(managerRegionId || undefined);

  const markets = useMemo(() => toOptions(toItems(marketsQuery.data)), [marketsQuery.data]);
  const branches = useMemo(
    () => (canUseBranchFilter ? toOptions((branchesQuery.data?.data ?? []) as Named[]) : []),
    [branchesQuery.data, canUseBranchFilter],
  );
  const couriers = useMemo(() => toOptions(toItems(couriersQuery.data)), [couriersQuery.data]);
  const regions = useMemo(() => {
    const data = regionsQuery.data as { data?: unknown } | unknown[] | undefined;
    const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    return toOptions(list as Named[]);
  }, [regionsQuery.data]);
  const districts = useMemo(
    () => toOptions((Array.isArray(districtsQuery.data) ? districtsQuery.data : []) as Named[]),
    [districtsQuery.data],
  );

  return {
    markets,
    marketsLoading: marketsQuery.isLoading,
    branches,
    branchesLoading: branchesQuery.isLoading,
    regions,
    regionsLoading: regionsQuery.isLoading,
    districts,
    districtsLoading: districtsQuery.isLoading,
    couriers,
    couriersLoading: couriersQuery.isLoading,
  };
};

export type OrderFilterOptions = ReturnType<typeof useOrderFilterOptions>;
