// dizayn-v2: superadmin-regions-districts, admin-regions-districts
import { memo, useCallback, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RootState } from "../../../../app/config/store";
import { api } from "../../../../shared/api/api";
import { API_ENDPOINTS } from "../../../../shared/api";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { notify } from "../../../../shared/lib/notify";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  IconButton,
  PageHeader,
  Select,
  SkeletonList,
  TextInput,
  useConfirm,
} from "../../../../shared/ui/primitives";
import DistrictBoard from "../../ui/DistrictBoard";
import DistrictDeleteBlockedDialog from "../../ui/DistrictDeleteBlockedDialog";
import DistrictMergeDialog from "../../ui/DistrictMergeDialog";
import { useDistrictMerge } from "../../ui/useDistrictMerge";
import { filterBoardRegions } from "../../model/boardModel";
import { httpStatusOf, mergeCandidates, type MergeDistrict } from "../../model/districtMerge";

type DistrictItem = { id: string; name: string };
type RegionWithDistricts = { id: string; name: string; districts: DistrictItem[] };

/** GET /region → viloyatlar va ularga (assigned_region bo'yicha) biriktirilgan tumanlar. */
const toRegionsWithDistricts = (payload: unknown): RegionWithDistricts[] => {
  const record = (payload ?? {}) as { data?: unknown };
  const body = record.data ?? payload;
  const raw = Array.isArray(body)
    ? body
    : Array.isArray((body as { items?: unknown })?.items)
      ? (body as { items: unknown[] }).items
      : [];
  return raw.map((item) => {
    const region = item as { id?: string | number; name?: string; districts?: unknown[] };
    return {
      id: String(region.id ?? ""),
      name: region.name ?? "—",
      districts: (Array.isArray(region.districts) ? region.districts : [])
        .map((d) => {
          const district = d as { id?: string | number; name?: string };
          return { id: String(district.id ?? ""), name: district.name ?? "—" };
        })
        .filter((district) => district.id)
        .sort((a, b) => a.name.localeCompare(b.name, "uz")),
    };
  });
};

const REGIONS_KEY = ["region-districts-admin"];

/**
 * TUMANLAR BOSHQARUVI (superadmin va admin — ega S1, DM-1): 14 viloyat va ularning tumanlari, tuman qo'shish
 * (POST `district`), nomini tahrirlash (PATCH `district/name/:id`), boshqa viloyatga sudrab / telefonda
 * «⇆» bilan o'tkazish (PATCH `district/:id {assigned_region}`, optimistik — xatoda joyiga qaytadi) va
 * o'chirish (`useConfirm`, DELETE `district/:id`). O'chirish 400 bersa (bog'langan yozuvlar bor) — «Tumanni
 * o'chirib bo'lmaydi» oynasi → «Tumanni birlashtirish» (`POST district/:id/merge`, maqsad — shu viloyatdan).
 * Xabarlarda faqat i18n matn (server matni ko'rsatilmaydi).
 */
const RegionDistrictsPage = () => {
  const { t, i18n } = useTranslation("region");
  const role = useSelector((state: RootState) => state.role.role);
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newRegionId, setNewRegionId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const canManage = role === "superadmin" || role === "admin";
  const [blocked, setBlocked] = useState<MergeDistrict | null>(null);

  const regionsQuery = useQuery({
    queryKey: REGIONS_KEY,
    queryFn: () =>
      api.get(API_ENDPOINTS.REGIONS.BASE).then((res) => toRegionsWithDistricts(res.data)),
    enabled: canManage,
    // Xato sahifada (`ErrorState` + «Qayta urinish») — global xabar takrorlanmaydi.
    meta: { silentError: true },
  });
  const regions = useMemo(() => regionsQuery.data ?? [], [regionsQuery.data]);

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: REGIONS_KEY }),
    [queryClient],
  );
  const merge = useDistrictMerge(refresh);
  /** 409 — shu viloyatda shu nomli tuman bor (qo'shish, nomini o'zgartirish); qolgani — umumiy matn. */
  const showError = (error: unknown, fallbackKey: string, conflictKey?: string) =>
    notify.error(t(conflictKey && httpStatusOf(error) === 409 ? conflictKey : fallbackKey));

  const createDistrict = useMutation({
    mutationFn: (payload: { name: string; region_id: string }) =>
      api.post(API_ENDPOINTS.DISTRICTS.BASE, payload),
    onSuccess: async () => {
      setNewName("");
      notify.success(t("districts.createSuccess"));
      await refresh();
    },
    onError: (error) => showError(error, "districts.createError", "v2.districts.duplicateName"),
  });

  const renameDistrict = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch(API_ENDPOINTS.DISTRICTS.UPDATE_NAME(id), { name }),
    onSuccess: async () => {
      setEditingId(null);
      notify.success(t("districts.renameSuccess"));
      await refresh();
    },
    onError: (error) => showError(error, "districts.renameError", "v2.districts.duplicateName"),
  });

  const deleteDistrict = useMutation({
    mutationFn: (district: MergeDistrict) => api.delete(API_ENDPOINTS.DISTRICTS.BY_ID(district.id)),
    onSuccess: async () => {
      notify.success(t("districts.deleteSuccess"));
      await refresh();
    },
    onError: (error, district) => {
      // 400 — tumanga buyurtma/foydalanuvchi/filial bog'langan (oNAE3LW9): birlashtirishni taklif qiladigan oyna.
      if (httpStatusOf(error) === 400) setBlocked(district);
      else showError(error, "districts.deleteError");
    },
  });

  // Optimistik ko'chirish: darhol yangi viloyatda ko'rinadi, xato bo'lsa
  // oldingi holat (snapshot) qaytariladi.
  const moveDistrict = useMutation({
    mutationFn: ({
      districtId,
      toRegionId,
    }: {
      districtId: string;
      fromRegionId: string;
      toRegionId: string;
    }) => api.patch(API_ENDPOINTS.DISTRICTS.BY_ID(districtId), { assigned_region: toRegionId }),
    onMutate: async ({ districtId, fromRegionId, toRegionId }) => {
      await queryClient.cancelQueries({ queryKey: REGIONS_KEY });
      const snapshot = queryClient.getQueryData<RegionWithDistricts[]>(REGIONS_KEY);
      queryClient.setQueryData<RegionWithDistricts[]>(REGIONS_KEY, (current = []) => {
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
              districts: [...region.districts, district].sort((a, b) =>
                a.name.localeCompare(b.name, "uz"),
              ),
            };
          return region;
        });
      });
      return { snapshot };
    },
    onError: (error, _vars, context) => {
      if (context?.snapshot) queryClient.setQueryData(REGIONS_KEY, context.snapshot);
      showError(error, "districts.moveError");
    },
    onSuccess: () => notify.success(t("districts.moveSuccess")),
    onSettled: () => {
      void refresh();
    },
  });

  const mergeSource = merge.state.phase === "idle" ? null : merge.state.source;
  const candidates = useMemo(
    () => (mergeSource ? mergeCandidates(regions, mergeSource) : []),
    [regions, mergeSource],
  );

  const totalDistricts = regions.reduce((sum, region) => sum + region.districts.length, 0);
  const filteredRegions = useMemo(() => filterBoardRegions(regions, search), [regions, search]);

  if (!canManage) {
    return <Navigate to="/regions" replace />;
  }

  const number = (value: number) => formatNumberLocalized(value, { language: i18n.language });
  const canCreate = newName.trim().length > 0 && Boolean(newRegionId) && !createDistrict.isPending;
  const submitNew = () => {
    if (!canCreate || !newRegionId) return;
    createDistrict.mutate({ name: newName.trim(), region_id: newRegionId });
  };
  const saveRename = (district: DistrictItem) => {
    const name = editingName.trim();
    if (!name || name === district.name) {
      setEditingId(null);
      return;
    }
    renameDistrict.mutate({ id: district.id, name });
  };

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        back="/regions"
        backLabel={t("v2.page.title")}
        title={t("v2.districts.title")}
        description={t("districts.description")}
        actions={
          <div
            role="group"
            aria-label={t("v2.board.countsAria")}
            className="flex flex-wrap gap-2 max-md:[&>*]:flex-none"
          >
            <Badge>
              {t("v2.board.regionsCount")}{" "}
              <span data-testid="regions-count" className="font-bold">
                {number(regions.length)}
              </span>
            </Badge>
            <Badge>
              {t("v2.board.districtsCount")}{" "}
              <span data-testid="districts-count" className="font-bold">
                {number(totalDistricts)}
              </span>
            </Badge>
          </div>
        }
      />

      <Card title={t("v2.districts.create.title")} divided={false}>
        <form
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,340px)_auto] items-end gap-3 max-md:grid-cols-1"
          onSubmit={(event) => {
            event.preventDefault();
            submitNew();
          }}
        >
          <Field label={t("v2.districts.create.name")} required>
            <TextInput
              value={newName}
              placeholder={t("districts.newName")}
              onChange={(event) => setNewName(event.target.value)}
            />
          </Field>
          <Field label={t("v2.districts.create.region")} required>
            <Select
              searchable
              value={newRegionId}
              placeholder={t("districts.newRegion")}
              options={regions.map((region) => ({ value: region.id, label: region.name }))}
              onChange={(value) => setNewRegionId(value)}
            />
          </Field>
          <Button
            type="submit"
            variant="primary"
            leftIcon={Plus}
            disabled={!canCreate}
            loading={createDistrict.isPending}
            className="max-md:w-full"
          >
            {t("districts.add")}
          </Button>
        </form>
      </Card>

      <TextInput
        mode="search"
        value={search}
        onValueChange={setSearch}
        aria-label={t("v2.board.searchAria")}
        placeholder={t("sato.searchPlaceholder")}
        className="w-full max-w-[480px] max-md:max-w-none"
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
          expandAll={search.trim().length > 0}
          onMove={(districtId, fromRegionId, toRegionId) =>
            moveDistrict.mutate({ districtId, fromRegionId, toRegionId })
          }
          editingId={editingId}
          renderEditor={(district) => (
            <>
              <TextInput
                autoFocus
                aria-label={t("districts.editName")}
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveRename(district);
                  }
                  if (event.key === "Escape") setEditingId(null);
                }}
                className="min-w-0 flex-1"
              />
              <IconButton
                size="sm"
                variant="secondary"
                icon={Check}
                label={t("districts.save")}
                loading={renameDistrict.isPending}
                onClick={() => saveRename(district)}
              />
              <IconButton
                size="sm"
                variant="ghost"
                icon={X}
                label={t("districts.cancel")}
                onClick={() => setEditingId(null)}
              />
            </>
          )}
          renderActions={(district, region) => (
            <>
              <IconButton
                size="sm"
                variant="ghost"
                icon={Pencil}
                label={t("v2.board.editAria", { name: district.name })}
                onClick={() => {
                  setEditingId(district.id);
                  setEditingName(district.name);
                }}
              />
              <IconButton
                size="sm"
                variant="ghost"
                icon={Trash2}
                label={t("v2.board.deleteAria", { name: district.name })}
                onClick={async () => {
                  const ok = await confirm({
                    tone: "danger",
                    title: t("v2.board.deleteConfirm", { name: district.name }),
                    confirmLabel: t("districts.delete"),
                    cancelLabel: t("districts.cancel"),
                    icon: Trash2,
                    confirmIcon: Trash2,
                    irreversible: true,
                  });
                  // Xato bo'lsa mutatsiyaning o'zi xabar yoki «o'chirib bo'lmaydi» oynasini chiqaradi.
                  if (ok)
                    deleteDistrict.mutate({
                      id: district.id,
                      name: district.name,
                      regionId: region.id,
                      regionName: region.name,
                    });
                }}
              />
            </>
          )}
        />
      )}

      <DistrictDeleteBlockedDialog
        district={blocked}
        onClose={() => setBlocked(null)}
        onMerge={(district) => {
          setBlocked(null);
          merge.open(district);
        }}
      />
      <DistrictMergeDialog merge={merge} candidates={candidates} />
    </div>
  );
};

export default memo(RegionDistrictsPage);
