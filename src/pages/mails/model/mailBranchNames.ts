import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { branchTypeOf } from "../../../app/lib/access";
import { useBranches, useDispatchBranchNames } from "../../../entities/branch";
import { getCurrentBranchId } from "../../../shared/lib/currentBranch";
import { readBranchName } from "../../../widgets/header/model/userIdentity";

/**
 * «FILIAL» USTUNI (Bahodir, 2026-11-04): pochta jadvalida «Kuryer» o'rniga — pochta filialga jo'natiladi.
 *
 * Kim ko'radi: barcha filiallar pochtasini ko'radigan HQ xodimlari — superadmin, admin, registrator. Menejerda
 * «Kuryer» qoladi: uning ro'yxati faqat o'z filiali (`branch_id`) — filial hamma qatorda bir xil, kuryer esa
 * pochta qaysi kuryeriga ketganini aytadi. Kuryerda ikkalasi ham yo'q (avvalgidek).
 */
export const selectMailsBranchColumn = (state: RootState): boolean => {
  const role = state.role.role;
  return role === "superadmin" || role === "admin" || role === "registrator";
};

/** Pochta filiali id'si; filial yo'q (YANGI pochta: `null`, `'0'`) — bo'sh qator. */
export const readMailBranchId = (value: unknown): string => {
  const id = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  return id === "0" ? "" : id;
};

/** Ro'yxatda filiali bor pochta bormi — yo'q bo'lsa nomlar so'ralmaydi (masalan «Bugungi» YANGI pochtalari). */
export const hasMailBranch = (mails: ReadonlyArray<{ branch_id?: unknown }>): boolean =>
  mails.some((mail) => readMailBranchId(mail.branch_id) !== "");

/** `GET branches` ning bitta sahifasi — `BatchesPage` dagi bilan bir xil parametr (bitta kesh yozuvi). */
const ALL_BRANCHES = { page: 1, limit: 1000 };

/**
 * Pochta `branch_id` → filial nomi. Ro'yxat javobida faqat id keladi, nomi — rol ochiq bo'lgan manbadan:
 *  - superadmin, admin — `GET branches` (barcha filiallar, HQ ham);
 *  - HQ registratori — `GET branches/dispatch-destinations` (faol REGIONAL / HYBRID);
 *  - hammada — o'z filiali (profil `branch`).
 * Nom topilmasa — «Filial #10» (viloyatdagi «Viloyat #12» kabi); filial yo'q (YANGI pochta, `null`, `'0'`) — `null`.
 * Xato (403, tarmoq) xabarsiz — zaxira matn turadi.
 */
export const useMailBranchName = (enabled: boolean) => {
  const { t } = useTranslation("mails");
  const role = useSelector((state: RootState) => state.role.role);
  const isHqRegistrator = useSelector(
    (state: RootState) => state.role.role === "registrator" && branchTypeOf(state) === "HQ",
  );
  const ownBranchId = useSelector(getCurrentBranchId);
  const ownBranchName = useSelector((state: RootState) => readBranchName(state.user.user));
  const canListAll = role === "superadmin" || role === "admin";

  const { data: allBranches } = useBranches(ALL_BRANCHES, enabled && canListAll, {
    silentError: true,
  });
  const destinations = useDispatchBranchNames(enabled && isHqRegistrator);

  const names = useMemo(() => {
    const map = new Map(destinations);
    for (const branch of allBranches?.data ?? []) {
      const name = String(branch.name ?? "").trim();
      if (name) map.set(String(branch.id), name);
    }
    if (ownBranchId && ownBranchName) map.set(ownBranchId, ownBranchName);
    return map;
  }, [allBranches?.data, destinations, ownBranchId, ownBranchName]);

  return useCallback(
    (branchId: unknown): string | null => {
      const id = readMailBranchId(branchId);
      if (!id) return null;
      return names.get(id) || t("branchHashFallback", { id });
    },
    [names, t],
  );
};
