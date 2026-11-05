import { CircleCheck, CircleSlash, CircleX, Clock, RotateCcw, TimerReset, type LucideIcon } from "lucide-react";
import {
  isExtraCostTab,
  extraCostProofPath,
  type ExtraCostRow,
  type ExtraCostTab,
} from "../../../entities/orders/extraCosts";
import type { ProofSource } from "../../../entities/order";
import type { Tone } from "../../../shared/ui/primitives";

/**
 * «QO'SHIMCHA XARAJATLI BUYURTMALAR» sahifasining sof qismi (GykuOz8f): kim ko'radi, URL'dagi tab, holat belgisi,
 * sana va sabab matni, isbot fayllari manzili.
 */

/** Backend `GET orders/extra-costs` `limit` qiymatlari (gateway `parsePaginationQuery` — 10, 25, 50, 100). */
export const EXTRA_COST_PAGE_SIZES = [10, 25, 50, 100] as const;
export const EXTRA_COST_DEFAULT_LIMIT = 25;

const TAB_PARAM = "tab";

/** Sahifani ko'radigan rollar (`access.ts` → `canViewExtraCosts`). */
export type ExtraCostViewer = "courier" | "manager" | "market" | "market_operator";

export const toExtraCostViewer = (role: string | null | undefined): ExtraCostViewer | null =>
  role === "courier" || role === "manager" || role === "market" || role === "market_operator" ? role : null;

/** Market tomoni (tab nomi «Tasdiqlash kutilayotgan»). */
export const isMarketSideViewer = (viewer: ExtraCostViewer | null): boolean =>
  viewer === "market" || viewer === "market_operator";

/** «Kim yozgan» ustuni — menejer (filial kuryerlari), market va operator; kuryerda doim o'zi, ustun yo'q. */
export const showsRequester = (viewer: ExtraCostViewer | null): boolean => viewer !== null && viewer !== "courier";

/** Qaror (tasdiqlash / rad etish) — faqat market egasi; operator faqat ko'radi. */
export const canDecideExtraCosts = (viewer: ExtraCostViewer | null): boolean => viewer === "market";

/** URL → tab (`?tab=`); noma'lum yoki yo'q — «Barchasi». */
export const readExtraCostTab = (params: URLSearchParams): ExtraCostTab => {
  const value = params.get(TAB_PARAM);
  return isExtraCostTab(value) ? value : "all";
};

/** Tab almashdi → URL: «Barchasi» — parametrsiz; sahifa 1 ga qaytadi (`page` o'chadi), `limit` qoladi. */
export const writeExtraCostTab = (prev: URLSearchParams, tab: ExtraCostTab): URLSearchParams => {
  const next = new URLSearchParams(prev);
  if (tab === "all") next.delete(TAB_PARAM);
  else next.set(TAB_PARAM, tab);
  next.delete("page");
  return next;
};

/** Tab yorlig'i kaliti (market tomonida kutilayotganlar — «Tasdiqlash kutilayotgan»). */
export const extraCostTabLabelKey = (tab: ExtraCostTab, viewer: ExtraCostViewer | null): string =>
  tab === "pending" && isMarketSideViewer(viewer) ? "tabs.pendingMarket" : `tabs.${tab}`;

/** Bo'sh holat matni kaliti (`empty.<kalit>` va `empty.<kalit>Description`). */
export const extraCostEmptyKey = (tab: ExtraCostTab, viewer: ExtraCostViewer | null): string =>
  tab === "pending" && isMarketSideViewer(viewer) ? "pendingMarket" : tab;

export type ExtraCostStatusKind = "pending" | "approved" | "auto" | "immediate" | "rejected" | "void" | "reversed";

/** Qator holati: tasdiqlanganlar uch xil — qo'lda, avtomatik (24 soat), tasdiqsiz darhol yozilgan. */
export const extraCostStatusKind = (row: Pick<ExtraCostRow, "status" | "auto_approved" | "immediate">): ExtraCostStatusKind => {
  if (row.status === "approved") return row.immediate ? "immediate" : row.auto_approved ? "auto" : "approved";
  return row.status;
};

/**
 * Holat → ton va ikonka (`docs/DESIGN_SYSTEM.md` §8): kutilmoqda — warning, tasdiqlangan — success, rad etilgan —
 * danger, o'zi yopilgan va teskari qaytarilgan — neytral (zanjir yopildi, pul yozilmagan / qaytarilgan).
 */
export const EXTRA_COST_STATUS_META: Record<ExtraCostStatusKind, { tone: Tone; icon: LucideIcon }> = {
  pending: { tone: "warning", icon: Clock },
  approved: { tone: "success", icon: CircleCheck },
  auto: { tone: "success", icon: TimerReset },
  immediate: { tone: "success", icon: CircleCheck },
  rejected: { tone: "danger", icon: CircleX },
  void: { tone: "neutral", icon: CircleSlash },
  reversed: { tone: "neutral", icon: RotateCcw },
};

/** Qaror (yoki yopilish) sanasi: tasdiq / rad — `decided_at`, `void` / `reversed` — `closed_at`. */
export const extraCostDecisionDate = (row: Pick<ExtraCostRow, "decided_at" | "closed_at">): string | null =>
  row.decided_at ?? row.closed_at ?? null;

/**
 * Sabab yoki izoh: rad etilgan — sabab nomi (+ izoh), o'zi yopilgan / teskari qaytarilgan — `closed_reason`, qolganida —
 * qaror izohi (bo'lsa). `reasonLabel` — rad etish sababining tarjimasi (bo'lmasa backend `reject_reason_label`).
 */
export const extraCostReasonText = (
  row: Pick<ExtraCostRow, "status" | "decision_comment" | "closed_reason" | "reject_reason_label">,
  reasonLabel: string | null,
): string | null => {
  const comment = row.decision_comment?.trim() || null;
  if (row.status === "rejected") {
    const label = reasonLabel ?? row.reject_reason_label;
    if (label && comment) return `${label}: ${comment}`;
    return label ?? comment;
  }
  if (row.status === "void" || row.status === "reversed") return row.closed_reason?.trim() || comment;
  return comment;
};

/** Buyurtma tafsiloti (barcha rollar uchun bitta yo'l — `routes.tsx` → `/orders/edit/:orderId`). */
export const extraCostOrderHref = (row: Pick<ExtraCostRow, "order_id">) =>
  `/orders/edit/${encodeURIComponent(row.order_id)}`;

/**
 * Isbot fayllari — so'rovning o'z yo'li orqali (`GET orders/extra-costs/:id/proofs/:index`): nom va tur kalitdan,
 * kalit kelmagan eski qatorda — tartib raqami (tur javobning `Content-Type` idan aniqlanadi).
 */
export const extraCostProofSources = (
  row: Pick<ExtraCostRow, "id" | "proof_file_keys" | "proof_count">,
): ProofSource[] => {
  const keys = row.proof_file_keys.length
    ? row.proof_file_keys
    : Array.from({ length: row.proof_count }, (_, index) => `isbot-${index + 1}`);
  return keys.map((key, index) => ({ key, url: extraCostProofPath(row.id, index) }));
};
