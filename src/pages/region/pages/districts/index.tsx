import { memo, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Button, Input, Popconfirm, Select, message } from "antd";
import { Check, GripVertical, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RootState } from "../../../../app/config/store";
import { api } from "../../../../shared/api/api";
import { API_ENDPOINTS } from "../../../../shared/api";
import { getBackendErrorMessage } from "../../../../shared/lib/backendError";
import PageContainer from "../../../../shared/ui/PageContainer";
import BackButton from "../../../../shared/ui/BackButton";
import QueryErrorState from "../../../../shared/ui/QueryErrorState";

export type DistrictItem = { id: string; name: string };
export type RegionWithDistricts = { id: string; name: string; districts: DistrictItem[] };

/** GET /region → viloyatlar va ularga (assigned_region bo'yicha) biriktirilgan tumanlar. */
export const toRegionsWithDistricts = (payload: unknown): RegionWithDistricts[] => {
  const record = (payload ?? {}) as { data?: unknown };
  const body = record.data ?? payload;
  const raw = Array.isArray(body)
    ? body
    : Array.isArray((body as { items?: unknown })?.items)
      ? ((body as { items: unknown[] }).items)
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
 * TUMANLAR BOSHQARUVI (7exC7QKt). Ilgari bu sahifa sarlavha + bitta izohdan
 * iborat placeholder edi. Endi: 14 viloyat va ularning tumanlari, tuman
 * qo'shish, nomini tahrirlash, boshqa viloyatga sudrab o'tkazish (xato bo'lsa
 * joyiga qaytadi) va o'chirish. Faqat superadmin.
 */
const RegionDistrictsPage = () => {
  const { t } = useTranslation("region");
  const role = useSelector((state: RootState) => state.role.role);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newRegionId, setNewRegionId] = useState<string | undefined>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const regionsQuery = useQuery({
    queryKey: REGIONS_KEY,
    queryFn: () => api.get(API_ENDPOINTS.REGIONS.BASE).then((res) => toRegionsWithDistricts(res.data)),
    enabled: role === "superadmin",
  });
  const regions = useMemo(() => regionsQuery.data ?? [], [regionsQuery.data]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: REGIONS_KEY });
  const showError = (error: unknown, fallbackKey: string) =>
    message.error(getBackendErrorMessage(error) ?? t(fallbackKey));

  const createDistrict = useMutation({
    mutationFn: (payload: { name: string; region_id: string }) => api.post(API_ENDPOINTS.DISTRICTS.BASE, payload),
    onSuccess: async () => {
      setNewName("");
      message.success(t("districts.createSuccess"));
      await refresh();
    },
    onError: (error) => showError(error, "districts.createError"),
  });

  const renameDistrict = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch(API_ENDPOINTS.DISTRICTS.UPDATE_NAME(id), { name }),
    onSuccess: async () => {
      setEditingId(null);
      message.success(t("districts.renameSuccess"));
      await refresh();
    },
    onError: (error) => showError(error, "districts.renameError"),
  });

  const deleteDistrict = useMutation({
    mutationFn: (id: string) => api.delete(API_ENDPOINTS.DISTRICTS.BY_ID(id)),
    onSuccess: async () => {
      message.success(t("districts.deleteSuccess"));
      await refresh();
    },
    onError: (error) => showError(error, "districts.deleteError"),
  });

  // Optimistik ko'chirish: darhol yangi viloyatda ko'rinadi, xato bo'lsa
  // oldingi holat (snapshot) qaytariladi.
  const moveDistrict = useMutation({
    mutationFn: ({ districtId, toRegionId }: { districtId: string; fromRegionId: string; toRegionId: string }) =>
      api.patch(API_ENDPOINTS.DISTRICTS.BY_ID(districtId), { assigned_region: toRegionId }),
    onMutate: async ({ districtId, fromRegionId, toRegionId }) => {
      await queryClient.cancelQueries({ queryKey: REGIONS_KEY });
      const snapshot = queryClient.getQueryData<RegionWithDistricts[]>(REGIONS_KEY);
      queryClient.setQueryData<RegionWithDistricts[]>(REGIONS_KEY, (current = []) => {
        const district = current.find((r) => r.id === fromRegionId)?.districts.find((d) => d.id === districtId);
        if (!district) return current;
        return current.map((region) => {
          if (region.id === fromRegionId) return { ...region, districts: region.districts.filter((d) => d.id !== districtId) };
          if (region.id === toRegionId) return { ...region, districts: [...region.districts, district].sort((a, b) => a.name.localeCompare(b.name, "uz")) };
          return region;
        });
      });
      return { snapshot };
    },
    onError: (error, _vars, context) => {
      if (context?.snapshot) queryClient.setQueryData(REGIONS_KEY, context.snapshot);
      showError(error, "districts.moveError");
    },
    onSuccess: () => message.success(t("districts.moveSuccess")),
    onSettled: () => {
      void refresh();
    },
  });

  const totalDistricts = regions.reduce((sum, region) => sum + region.districts.length, 0);
  const filteredRegions = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("uz");
    if (!term) return regions;
    return regions
      .map((region) => ({
        ...region,
        districts: region.name.toLocaleLowerCase("uz").includes(term)
          ? region.districts
          : region.districts.filter((district) => district.name.toLocaleLowerCase("uz").includes(term)),
      }))
      .filter((region) => region.districts.length > 0 || region.name.toLocaleLowerCase("uz").includes(term));
  }, [regions, search]);

  if (role !== "superadmin") {
    return <Navigate to="/regions" replace />;
  }

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
    <PageContainer>
      <BackButton to="/regions" className="mb-4 h-10 min-w-10 rounded-xl px-3" />
      <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-3 md:p-4 dark:bg-primarydark">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-bold text-main dark:text-primary">{t("districts.title")}</h1>
            <p className="mt-1 text-sm text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {t("districts.description")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-main dark:text-primary">
            <div className="rounded-xl border border-[color:var(--color-border-soft)] bg-sidebar px-3 py-2">
              {t("sato.regionsCount")}: <span data-testid="regions-count" className="font-semibold">{regions.length}</span>
            </div>
            <div className="rounded-xl border border-[color:var(--color-border-soft)] bg-sidebar px-3 py-2">
              {t("sato.districtsCount")}: <span data-testid="districts-count" className="font-semibold">{totalDistricts}</span>
            </div>
          </div>
        </div>

        {/* Yangi tuman */}
        <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-[color:var(--color-border-soft)] bg-sidebar p-2.5 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)_auto]">
          <Input
            aria-label={t("districts.newName")}
            placeholder={t("districts.newName")}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onPressEnter={submitNew}
          />
          <Select
            aria-label={t("districts.newRegion")}
            placeholder={t("districts.newRegion")}
            value={newRegionId}
            onChange={setNewRegionId}
            options={regions.map((region) => ({ value: region.id, label: region.name }))}
            showSearch={{ optionFilterProp: "label" }}
            className="w-full"
          />
          <Button type="primary" icon={<Plus size={16} />} disabled={!canCreate} loading={createDistrict.isPending} onClick={submitNew}>
            {t("districts.add")}
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[color:var(--color-border-soft)] bg-sidebar px-3 py-2">
          <Search size={16} className="text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]" />
          <input
            aria-label={t("sato.searchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("sato.searchPlaceholder")}
            className="w-full bg-transparent text-base md:text-sm text-main outline-none placeholder:text-[color:var(--color-text-muted)] dark:placeholder:text-[color:var(--color-text-muted-dark)] dark:text-primary"
          />
        </div>

        {regionsQuery.isError ? (
          <QueryErrorState onRetry={() => void regionsQuery.refetch()} className="mt-4" />
        ) : regionsQuery.isLoading ? (
          <div className="mt-4 rounded-xl border border-[color:var(--color-border-soft)] bg-sidebar p-4 text-sm text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
            {t("common:loading")}
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredRegions.map((region) => (
              <section
                key={region.id}
                aria-label={region.name}
                data-testid={`region-${region.id}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropTargetId(region.id);
                }}
                onDragLeave={() => setDropTargetId((current) => (current === region.id ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  setDropTargetId(null);
                  const districtId = event.dataTransfer.getData("districtId");
                  const fromRegionId = event.dataTransfer.getData("fromRegionId");
                  if (districtId && fromRegionId && fromRegionId !== region.id) {
                    moveDistrict.mutate({ districtId, fromRegionId, toRegionId: region.id });
                  }
                }}
                className={`rounded-xl border bg-sidebar p-2.5 transition-shadow ${
                  dropTargetId === region.id ? "border-main shadow-md" : "border-[color:var(--color-border-soft)]"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="m-0 truncate text-sm font-semibold text-main dark:text-primary">{region.name}</h2>
                  <span className="rounded-lg bg-primary px-2 py-1 text-xs font-medium text-[color:var(--color-text-muted)] dark:bg-white/10 dark:text-[color:var(--color-text-muted-dark)]">
                    {t("sato.districtCount", { count: region.districts.length })}
                  </span>
                </div>
                <ul className="m-0 max-h-[320px] list-none space-y-1.5 overflow-y-auto p-0 pr-1">
                  {region.districts.length === 0 ? (
                    <li className="rounded-lg border border-dashed border-[color:var(--color-border-soft)] bg-primary px-2 py-3 text-center text-xs text-[color:var(--color-text-muted)] dark:bg-white/5 dark:text-[color:var(--color-text-muted-dark)]">
                      {t("sato.noDistricts")}
                    </li>
                  ) : (
                    region.districts.map((district) => {
                      const isEditing = editingId === district.id;
                      return (
                        <li
                          key={district.id}
                          data-testid={`district-${district.id}`}
                          draggable={!isEditing}
                          onDragStart={(event) => {
                            event.dataTransfer.setData("districtId", district.id);
                            event.dataTransfer.setData("fromRegionId", region.id);
                            setDraggingId(district.id);
                          }}
                          onDragEnd={() => setDraggingId(null)}
                          className={`flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-soft)] bg-primary px-2 py-1.5 dark:bg-white/5 ${
                            draggingId === district.id ? "opacity-60" : ""
                          }`}
                        >
                          {isEditing ? (
                            <>
                              <Input
                                size="small"
                                autoFocus
                                aria-label={t("districts.editName")}
                                value={editingName}
                                onChange={(event) => setEditingName(event.target.value)}
                                onPressEnter={() => saveRename(district)}
                                onKeyDown={(event) => {
                                  if (event.key === "Escape") setEditingId(null);
                                }}
                              />
                              <Button size="small" type="text" aria-label={t("districts.save")} icon={<Check size={14} />} loading={renameDistrict.isPending} onClick={() => saveRename(district)} />
                              <Button size="small" type="text" aria-label={t("districts.cancel")} icon={<X size={14} />} onClick={() => setEditingId(null)} />
                            </>
                          ) : (
                            <>
                              <GripVertical size={14} aria-hidden className="shrink-0 cursor-grab text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]" />
                              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-main dark:text-primary">{district.name}</span>
                              <Button
                                size="small"
                                type="text"
                                aria-label={t("districts.editAria", { name: district.name })}
                                icon={<Pencil size={13} />}
                                onClick={() => {
                                  setEditingId(district.id);
                                  setEditingName(district.name);
                                }}
                              />
                              <Popconfirm
                                title={t("districts.deleteConfirm", { name: district.name })}
                                okText={t("districts.delete")}
                                cancelText={t("districts.cancel")}
                                okButtonProps={{ danger: true }}
                                onConfirm={() => deleteDistrict.mutate(district.id)}
                              >
                                <Button size="small" type="text" danger aria-label={t("districts.deleteAria", { name: district.name })} icon={<Trash2 size={13} />} />
                              </Popconfirm>
                            </>
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default memo(RegionDistrictsPage);
