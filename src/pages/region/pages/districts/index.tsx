// dizayn-v2: superadmin-regions-districts, admin-regions-districts
import { memo, useCallback, useMemo, useRef, useState, type RefObject } from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RootState } from "../../../../app/config/store";
import { DISTRICT_KEY } from "../../../../entities/logistics/api/logisticsApi";
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
import { useSatoCodeOwner } from "../../ui/useSatoCodeOwner";
import {
  satoClientError,
  useSatoEditorErrorText,
  type SatoEditorError,
} from "../../ui/sato/useSatoCodeEditor";
import { classifyDistrictSatoError, validateDistrictSatoCode } from "../../model/districtSatoCode";
import {
  filterBoardRegions,
  normalizeBoardRegions,
  type BoardRegionItem,
} from "../../model/boardModel";
import {
  deleteBlockedUsage,
  districtUsageKey,
  httpStatusOf,
  mergeCandidates,
  type MergeCounts,
  type MergeDistrict,
} from "../../model/districtMerge";

/** «Yangi tuman qo'shish» maydon xatolari (maydon o'zgarguncha turadi). */
type CreateErrors = { name?: string; region?: string; code?: SatoEditorError };

type CreateDistrictVars = {
  name: string;
  regionId: string;
  regionName: string;
  /** Viloyat SOATO kodi — server `expected_prefix` bermasa zaxira. */
  regionPrefix: string | null;
  code: string;
};

const REGIONS_KEY = ["region-districts-admin"];
/**
 * Tumanlar o'zgarsa boshqa ekranlar keshi ham eskiradi: tuman tanlagichlari (`useRegionDistrictCatalog`,
 * 5 daqiqa), viloyat statistikasi (`region-stats`), SATO tabi (`district-sato`: preview + `/district`, SA-2) —
 * birlashtirilgan/o'chirilgan tuman qolib ketmasin (SATO tabida unga kod yozish yoki birlashtirish taklif qilinmasin) —
 * va `/regions/sato-management` dagi o'tkazish doskasi (`regions/with-districts`; ko'chirilgan tuman o'sha doskada
 * ham yangi viloyatida turadi, kGvjztpY).
 */
const DEPENDENT_KEYS = [
  ["region-district-catalog"],
  ["region-stats"],
  ["district-sato"],
  ["regions", "with-districts"],
];

/**
 * TUMANLAR BOSHQARUVI (superadmin va admin — ega S1, DM-1): 14 viloyat va ularning tumanlari, tuman qo'shish
 * (POST `district {name, region_id, sato_code}` — SOATO kodi majburiy, 7 raqam, viloyat kodi bilan boshlanadi;
 * xatolar maydonlar ostida, ExK28CiS), nomini tahrirlash (PATCH `district/name/:id`), boshqa viloyatga sudrab /
 * telefonda «⇆» bilan o'tkazish (PATCH `district/:id {assigned_region}`, optimistik — xatoda joyiga qaytadi) va
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
  const [newCode, setNewCode] = useState("");
  const [createErrors, setCreateErrors] = useState<CreateErrors>({});
  const codeErrorText = useSatoEditorErrorText();
  const lookupOwner = useSatoCodeOwner();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const canManage = role === "superadmin" || role === "admin";
  const [blocked, setBlocked] = useState<{ district: MergeDistrict; usage: MergeCounts | null } | null>(null);

  const regionsQuery = useQuery({
    queryKey: REGIONS_KEY,
    queryFn: () =>
      api.get(API_ENDPOINTS.REGIONS.BASE).then((res) => normalizeBoardRegions(res.data)),
    enabled: canManage,
    // Xato sahifada (`ErrorState` + «Qayta urinish») — global xabar takrorlanmaydi.
    meta: { silentError: true },
  });
  const regions = useMemo(() => regionsQuery.data ?? [], [regionsQuery.data]);

  const refresh = useCallback(
    () =>
      Promise.all(
        [REGIONS_KEY, ...DEPENDENT_KEYS].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
    [queryClient],
  );
  // Birlashtirish oynasi «o'chirib bo'lmaydi» oynasidan ochiladi — u yopilgach fokus o'chirish tugmasiga
  // (birlashtirilgan tuman qatori yo'qolgan bo'lsa — qidiruv maydoniga) qaytadi.
  const deleteOriginRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const mergeReturnFocus = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        const origin = deleteOriginRef.current;
        return origin?.isConnected ? origin : searchRef.current;
      },
    }),
    [],
  );
  const merge = useDistrictMerge(refresh);
  /** 409 — shu viloyatda shu nomli tuman bor (nomini o'zgartirish); qolgani — umumiy matn. */
  const showError = (error: unknown, fallbackKey: string, conflictKey?: string) =>
    notify.error(t(conflictKey && httpStatusOf(error) === 409 ? conflictKey : fallbackKey));

  const createDistrict = useMutation({
    mutationFn: ({ name, regionId, code }: CreateDistrictVars) =>
      api.post(API_ENDPOINTS.DISTRICTS.BASE, { name, region_id: regionId, sato_code: code }),
    onSuccess: async (_data, { name, regionName, code }) => {
      setNewName("");
      setNewCode("");
      setCreateErrors({});
      notify.success(t("districts.createSuccess"), {
        description: t("v2.districts.create.doneText", { name, region: regionName, code }),
      });
      // Yangi tuman geografik tuman ro'yxatlarida ham (`useGetDistricts` — `GET region/:id`: buyurtma yaratish,
      // manzil, filtrlar) darhol chiqsin; ko'chirish bu ro'yxatni o'zgartirmaydi.
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: [DISTRICT_KEY] })]);
    },
    // Xato maydon ostida (server matni ko'rsatilmaydi); sababi noma'lum bo'lsa — umumiy xabar.
    onError: async (error, { regionName, regionPrefix, code }) => {
      const failed = () =>
        notify.error(t("districts.createError"), { description: t("v2.sato.add.failedText") });
      const server = classifyDistrictSatoError(error);
      if (server.kind === "conflict") {
        // 409 sababsiz: nom yoki kod band — kod egasi so'raladi (200 — kod band, egasi o'qilmasa ham; 404 — kod
        // bo'sh, demak nom band). Umumiy xabar faqat so'rovning o'zi yiqilsa (5xx, aloqa).
        const owner = await lookupOwner(code);
        if (owner.kind === "owner")
          setCreateErrors({ code: { kind: "taken", district: owner.name, region: owner.regionName } });
        else if (owner.kind === "taken") setCreateErrors({ code: { kind: "takenUnknown" } });
        else if (owner.kind === "none") setCreateErrors({ name: t("v2.districts.duplicateName") });
        else failed();
      } else if (server.kind === "regionMissing") {
        setCreateErrors({ region: t("v2.sato.add.regionMissing") });
      } else if (server.kind === "prefix" || server.kind === "format") {
        // Prefiks — serverdagi `details.expected_prefix` ustun.
        const prefix = server.kind === "prefix" ? (server.expectedPrefix ?? regionPrefix) : null;
        setCreateErrors({ code: prefix ? { kind: "prefix", prefix, region: regionName } : { kind: "format" } });
      } else failed();
    },
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
      // `data.usage` — «Bog'langan» sonlari; birlashtirish oynasining «… ko'chadi» sonlari ham shundan boshlanadi.
      if (httpStatusOf(error) === 400) {
        const usage = deleteBlockedUsage(error);
        if (usage) queryClient.setQueryData<MergeCounts | null>(districtUsageKey(district.id), usage);
        setBlocked({ district, usage });
      } else showError(error, "districts.deleteError");
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
      const snapshot = queryClient.getQueryData<BoardRegionItem[]>(REGIONS_KEY);
      queryClient.setQueryData<BoardRegionItem[]>(REGIONS_KEY, (current = []) => {
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
  const newRegion = regions.find((region) => region.id === newRegionId) ?? null;
  const submitNew = () => {
    if (!canCreate || !newRegion) return;
    const code = newCode.trim();
    // Klientda so'rovdan oldin: bo'sh, 7 raqam emas, viloyat prefiksi mos emas (viloyatda kod yo'q — tekshirilmaydi).
    const codeError = validateDistrictSatoCode(code, newRegion.satoCode);
    if (codeError) {
      setCreateErrors((current) => ({ ...current, code: satoClientError(codeError, newRegion.name) }));
      return;
    }
    createDistrict.mutate({
      name: newName.trim(),
      regionId: newRegion.id,
      regionName: newRegion.name,
      regionPrefix: newRegion.satoCode,
      code,
    });
  };
  const changeRegion = (regionId: string | null) => {
    setNewRegionId(regionId);
    // Viloyat almashsa: eski viloyat xatosi va prefiks xatosi ketadi; to'liq kod yangi viloyatga mos kelmasa — darhol.
    const region = regions.find((item) => item.id === regionId);
    const mismatch = newCode.trim() ? validateDistrictSatoCode(newCode, region?.satoCode) : null;
    setCreateErrors((current) => ({
      ...current,
      region: undefined,
      code:
        mismatch?.kind === "prefix" && region
          ? satoClientError(mismatch, region.name)
          : current.code?.kind === "prefix"
            ? undefined
            : current.code,
    }));
  };
  const codeHint = !newRegion
    ? t("v2.districts.create.codeHintNoRegion")
    : newRegion.satoCode
      ? t("v2.districts.create.codeHint", { region: newRegion.name, prefix: newRegion.satoCode })
      : t("v2.districts.create.codeHintNoPrefix");
  const saveRename = (district: { id: string; name: string }) => {
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
        {/*
          1440: bitta qator (nom 2 · viloyat 1 · kod 180 px · tugma); 768: 2×2; 390: ustma-ust, tugma to'liq enli.
          Qatorlar tepadan tekislanadi — ko'rsatma/xato maydon ostida, tugma yorliq balandligidagi bo'sh joy bilan
          maydonlar qatorida turadi.
        */}
        <form
          noValidate
          className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_180px_auto] items-start gap-3 max-lg:grid-cols-2 max-md:grid-cols-1"
          onSubmit={(event) => {
            event.preventDefault();
            submitNew();
          }}
        >
          <Field label={t("v2.districts.create.name")} required error={createErrors.name}>
            <TextInput
              value={newName}
              placeholder={t("districts.newName")}
              autoComplete="off"
              onChange={(event) => {
                setNewName(event.target.value);
                if (createErrors.name) setCreateErrors((current) => ({ ...current, name: undefined }));
              }}
            />
          </Field>
          <Field label={t("v2.districts.create.region")} required error={createErrors.region}>
            <Select
              searchable
              value={newRegionId}
              placeholder={t("districts.newRegion")}
              options={regions.map((region) => ({ value: region.id, label: region.name }))}
              onChange={(value) => changeRegion(value || null)}
            />
          </Field>
          <Field
            label={t("v2.districts.create.code")}
            required
            hint={codeHint}
            error={codeErrorText(createErrors.code ?? null) ?? undefined}
          >
            <TextInput
              mode="number"
              maxLength={7}
              autoComplete="off"
              value={newCode}
              onValueChange={(value) => {
                setNewCode(value);
                if (createErrors.code) setCreateErrors((current) => ({ ...current, code: undefined }));
              }}
            />
          </Field>
          <div className="flex flex-col gap-1.5 justify-self-start max-md:justify-self-stretch">
            {/* Yorliq o'rnidagi bo'sh joy (telefonda yo'q): tugma maydonlar bilan bir chiziqda. */}
            <span aria-hidden="true" className="invisible text-[13px] font-semibold max-md:hidden">
              {"\u00a0"}
            </span>
            <Button
              type="submit"
              variant="primary"
              leftIcon={Plus}
              disabled={!canCreate}
              loading={createDistrict.isPending}
              loadingText={t("v2.sato.add.saving")}
              className="max-md:w-full"
            >
              {t("districts.add")}
            </Button>
          </div>
        </form>
      </Card>

      <TextInput
        ref={searchRef}
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
                onClick={async (event) => {
                  deleteOriginRef.current = event.currentTarget;
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
        district={blocked?.district ?? null}
        usage={blocked?.usage}
        onClose={() => setBlocked(null)}
        onMerge={(district) => {
          setBlocked(null);
          merge.open(district);
        }}
      />
      <DistrictMergeDialog merge={merge} candidates={candidates} returnFocus={mergeReturnFocus} />
    </div>
  );
};

export default memo(RegionDistrictsPage);
