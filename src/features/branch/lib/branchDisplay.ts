import type { TFunction } from "i18next";
import type { Branch } from "../../../entities/branch";
import type { Tone } from "../../../shared/ui/primitives";

/**
 * Filial ko'rinishi uchun umumiy yordamchilar (ro'yxat, daraxt, kartalar, tafsilot, forma) — dizayn v2.
 * Matnlar `branches` nomlar fazosidan; rang faqat ton nomi (`Badge tone`), hex yo'q.
 */

/** Holat badge'i toni: «Faol» — yashil, «Nofaol» — neytral (maket `el-tone-neutral`). */
export const branchStatusTone = (status: Branch["status"]): Tone => (status === "active" ? "success" : "neutral");

/** «Faol» / «Nofaol». */
export const branchStatusLabel = (status: Branch["status"], t: TFunction) =>
  status === "active" ? t("branches:status.active") : t("branches:status.inactive");

/** Filial turi nomi: «HQ», «Viloyat», «Qabul punkti», «Aralash» (noma'lum — «Noma'lum»). */
export const branchTypeLabel = (type: Branch["type"] | string | undefined | null, t: TFunction) => {
  const normalized = String(type ?? "").toUpperCase();
  if (!normalized) return t("branches:branchTypes.unknown");
  return t(`branches:branchTypes.${normalized}`, { defaultValue: t("branches:branchTypes.unknown") });
};

/** Bo'sh yoki «—» qiymat — ko'rsatilmaydi (API `region: null` → normalizator «—» qo'yadi). */
export const knownText = (value: string | null | undefined) => {
  const text = String(value ?? "").trim();
  return text && text !== "—" ? text : "";
};

/** «Toshkent sh., Yunusobod tumani» — viloyat va tuman (bo'lganlari). */
export const branchAreaText = (branch: Pick<Branch, "region" | "district">) =>
  [knownText(branch.region?.name), knownText(branch.district?.name)].filter(Boolean).join(", ");

/** Xodim lavozimi kaliti (backend `BranchUserRole`: MANAGER · REGISTRATOR · COURIER; kichik harf ham keladi). */
export const branchPositionKey = (position: string | null | undefined) => String(position ?? "").trim().toUpperCase();

/** «Menejer» / «Ro'yxatchi» / «Kuryer»; noma'lum lavozim — o'zi (yoki «Xodim»). */
export const branchPositionLabel = (position: string | null | undefined, t: TFunction) => {
  const key = branchPositionKey(position);
  if (!key) return t("branches:fallback.employee");
  return t(`branches:v2.positions.${key}`, { defaultValue: String(position) });
};
