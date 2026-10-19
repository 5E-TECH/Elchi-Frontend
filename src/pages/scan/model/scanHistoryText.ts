import type { TFunction } from "i18next";
import { Boxes, Mail, Package, PackageOpen, Undo2, type LucideIcon } from "lucide-react";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import type { ScanHistoryEntry, ScanHistoryKind } from "./scanHistory";

/** Tarix qatori ikonkasi (maket «Oxirgi skanerlar»: buyurtma — quti, paket — qutilar, pochta — konvert). */
export const SCAN_HISTORY_ICON: Record<ScanHistoryKind, LucideIcon> = {
  order: Package,
  package: Boxes,
  "returned-package": Undo2,
  post: Mail,
  "external-bag": PackageOpen,
};

/** «№10241 · Buyurtma» / «Paket B-137» / «Pochta №2493» / «Qop · 12 ta posilka». */
export const scanHistoryTitle = (t: TFunction<"scan">, entry: ScanHistoryEntry, language: string) => {
  const ref = entry.ref ?? "—";
  switch (entry.kind) {
    case "order":
      return t("scanner.entry.order", { ref });
    case "package":
      return t("scanner.entry.package", { ref });
    case "returned-package":
      return t("scanner.entry.returnedPackage", { ref });
    case "post":
      return t("scanner.entry.post", { ref });
    default: {
      const count = entry.count ?? 0;
      return t("scanner.entry.bag", { count, value: formatNumberLocalized(count, { language }) });
    }
  }
};

/** Ikkinchi qator: buyurtmada «Mijoz · Tuman», paket va pochtada «Joy · N ta buyurtma», qopda izoh. */
export const scanHistorySub = (t: TFunction<"scan">, entry: ScanHistoryEntry, language: string) => {
  if (entry.kind === "order") return [entry.name, entry.place].filter(Boolean).join(" · ");
  if (entry.kind === "external-bag") return t("scanner.entry.bagSub");
  const count =
    entry.count === null
      ? null
      : t("ordersCount", { count: entry.count, value: formatNumberLocalized(entry.count, { language }) });
  return [entry.place, count].filter(Boolean).join(" · ");
};
