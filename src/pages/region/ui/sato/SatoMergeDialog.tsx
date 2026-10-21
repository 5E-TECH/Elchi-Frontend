// dizayn-v2: superadmin-regions-sato-codes-merge-dialog
import { useMemo, type RefObject } from "react";
import { Map as MapIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MergeDistrict } from "../../model/districtMerge";
import { satoMergeCandidates, type SatoDistrict } from "../../model/satoModel";
import DistrictMergeDialog, { type DistrictMergePresentation } from "../DistrictMergeDialog";
import type { SatoMergeController } from "./useSatoMerge";

type Props = {
  merge: SatoMergeController;
  districts: readonly SatoDistrict[];
  /** Guruh tugmasi yo'qolgan bo'lsa (birlashtirilgach) — fokus shu yerga (qidiruv maydoni). */
  fallbackFocus: RefObject<HTMLElement | null>;
};

/** Maket `superadmin-regions-sato-codes-merge-dialog`: yozuvlar «Nom · ID N», maqsad yonida SATO kodi. */
export const SatoMergeDialog = ({ merge, districts, fallbackFocus }: Props) => {
  const { t } = useTranslation("region");
  const { state, originRef } = merge;
  const source = state.phase === "idle" ? null : state.source;

  const codeById = useMemo(() => new Map(districts.map((district) => [district.id, district.satoCode])), [districts]);
  const candidates = useMemo<MergeDistrict[]>(
    () =>
      source
        ? satoMergeCandidates(districts, { id: source.id, regionId: source.regionId || null }).map((district) => ({
            id: district.id,
            name: district.name,
            regionId: district.region?.id ?? "",
            regionName: district.region?.name ?? source.regionName,
          }))
        : [],
    [districts, source],
  );

  const returnFocus = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        const origin = originRef.current;
        return origin?.isConnected ? origin : fallbackFocus.current;
      },
    }),
    [fallbackFocus, originRef],
  );

  const presentation = useMemo<DistrictMergePresentation>(() => {
    const codeOf = (district: MergeDistrict) => codeById.get(district.id) ?? null;
    const label = (district: MergeDistrict) => t("v2.sato.merge.option", { name: district.name, id: district.id });
    return {
      sourceIcon: MapIcon,
      displayName: (district) => t("v2.sato.merge.recordName", { name: district.name, id: district.id }),
      description: (from) => t("v2.sato.merge.text", { name: from.name, id: from.id }),
      sourceTitle: (from) => t("v2.sato.merge.sourceTitle", { name: from.name, id: from.id }),
      sourceSubtitle: (from) =>
        t("v2.sato.merge.sourceSubtitle", { region: from.regionName, code: codeOf(from) ?? t("v2.sato.row.noCode") }),
      option: (candidate) => {
        const code = codeOf(candidate);
        return { label: label(candidate), description: code ?? undefined, searchText: code ?? undefined };
      },
      // Maket: tanlangan maqsad yonida kod — qidiruvsiz ro'yxat (bir viloyat tumanlari, type-ahead ishlaydi).
      searchable: false,
      valueAddon: (target) => {
        const code = codeOf(target);
        return code ? <span className="text-text-muted tabular-nums">{code}</span> : null;
      },
      targetHint: (from, target) => {
        const targetCode = codeOf(target);
        const sourceCode = codeOf(from);
        const hint = targetCode
          ? t("v2.sato.merge.hintKeeps", { region: from.regionName, code: targetCode })
          : t("v2.sato.merge.hint", { region: from.regionName });
        return sourceCode && sourceCode !== targetCode
          ? `${hint} ${t("v2.sato.merge.sourceCodeLost", { id: from.id, code: sourceCode })}`
          : hint;
      },
      irreversibleText: (from) => t("v2.sato.merge.irreversibleText", { id: from.id }),
    };
  }, [codeById, t]);

  return (
    <DistrictMergeDialog merge={merge} candidates={candidates} presentation={presentation} returnFocus={returnFocus} />
  );
};
