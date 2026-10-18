/**
 * Viloyat tafsiloti oynasi — `/regions` xaritasi va dashboard kartogrammasi uchun umumiy.
 * Faqat dinamik import bilan ulang (bosilganda yuklanadi):
 *
 *   const RegionDetailDialog = lazy(() => import("../../region-detail"));
 */
import RegionDetailDialog from "./ui/RegionDetailDialog";

export type { RegionDetailCompany, RegionDetailDialogProps } from "./ui/RegionDetailDialog";
export { RegionDetailDialog };
export default RegionDetailDialog;
