import { useCallback, useRef, useState, type RefObject } from "react";
import type { MergeDistrict } from "../../model/districtMerge";
import type { SatoDuplicateGroup } from "../../model/satoModel";
import { useDistrictMerge, type DistrictMergeController } from "../useDistrictMerge";

export type SatoMergeController = DistrictMergeController & {
  /** Takroriy guruhning «Birlashtirish» tugmasi: manba (o'chadi) va maqsad (qoladi) oldindan tanlangan. */
  openGroup: (group: SatoDuplicateGroup) => void;
  /** Oyna yopilgach fokus: guruh tugmasi (qolgan bo'lsa), aks holda zaxira element. */
  originRef: RefObject<HTMLElement | null>;
  /**
   * Muvaffaqiyatli birlashtirilgan manbalar (o'chirilgan ID lar). Ro'yxat qayta yuklanguncha eski keshdagi guruh
   * yashiriladi — o'chgan yozuv uchun yana «Birlashtirish» bosilib 404 olinmasin. ID qayta ishlatilmaydi.
   */
  mergedIds: ReadonlySet<string>;
};

const toMergeDistrict = (row: { id: string; name: string; regionId: string | null; regionName: string }): MergeDistrict => ({
  id: row.id,
  name: row.name,
  regionId: row.regionId ?? "",
  regionName: row.regionName,
});

/**
 * SATO takroriylarini birlashtirish (SA-2, ega S4): tumanlar sahifasidagi umumiy `DistrictMergeDialog` va
 * `useDistrictMerge` (DM-1: `POST district/:id/merge`, 125 s, jarayon / natija / «noma'lum»). Sukut — kodsiz yozuv
 * kodli yozuvga qo'shiladi (`pickSatoMerge`). `refresh` — preview, `/district` va viloyatlar taxtasi.
 */
export const useSatoMerge = (refresh: () => unknown): SatoMergeController => {
  const merge = useDistrictMerge(refresh);
  const originRef = useRef<HTMLElement | null>(null);
  const { open, state } = merge;
  const [mergedIds, setMergedIds] = useState<ReadonlySet<string>>(() => new Set());
  if (state.phase === "result" && !mergedIds.has(state.source.id)) setMergedIds(new Set([...mergedIds, state.source.id]));
  const openGroup = useCallback(
    (group: SatoDuplicateGroup) => {
      if (!group.merge) return;
      originRef.current =
        typeof document === "undefined"
          ? null
          : document.querySelector<HTMLElement>(`[data-sato-merge="${group.key.replace(/["\\]/g, "\\$&")}"]`);
      open(toMergeDistrict(group.merge.source), group.merge.target.id);
    },
    [open],
  );
  return { ...merge, openGroup, originRef, mergedIds };
};
