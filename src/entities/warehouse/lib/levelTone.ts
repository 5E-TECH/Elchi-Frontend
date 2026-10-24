import type { Tone } from "../../../shared/ui/primitives";
import type { StockLevel } from "../model/types";

/** Qoldiq holati toni: «Yetarli» — success, «Kam qoldi» — warning, «Tugagan» — danger (DESIGN_SYSTEM §8). */
export const STOCK_LEVEL_TONE: Record<StockLevel, Tone> = { ok: "success", low: "warning", out: "danger" };
