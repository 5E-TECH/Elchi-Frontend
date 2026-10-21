import { useTranslation } from "react-i18next";
import type { Logist } from "../../../../../entities/logist";
import type { AssignmentDiff } from "./assignment";

/** Ro'yxatdagi belgi: «Nofaol» · «Viloyatsiz» · «4 viloyat» (serverdagi holat). */
export const useLogistBadgeText = () => {
  const { t } = useTranslation("region");
  return (logist: Logist, count: number) =>
    logist.status === "inactive"
      ? t("v2.logist.list.inactive")
      : count > 0
        ? t("v2.logist.list.regionCount", { count })
        : t("v2.logist.list.noRegions");
};

/** Oyna izohi: «Aziz Rahimov viloyatlari yangilanadi: 1 ta viloyat olib tashlanadi, 1 tasi boshqa logistdan o'tadi.» */
export const useConfirmDescription = () => {
  const { t } = useTranslation("region");
  return (name: string, diff: AssignmentDiff) => {
    const parts: string[] = [];
    if (diff.removed.length)
      parts.push(t("v2.logist.confirm.removedPart", { count: diff.removed.length }));
    if (diff.transferred.length) {
      parts.push(
        t(
          diff.removed.length
            ? "v2.logist.confirm.transferredPartAfter"
            : "v2.logist.confirm.transferredPart",
          {
            count: diff.transferred.length,
          },
        ),
      );
    }
    return t("v2.logist.confirm.description", { name, parts: parts.join(", ") });
  };
};
