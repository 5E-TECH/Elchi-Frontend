import type { AiAccessState } from "../../../entities/ai-advisor";

/** «Limit yaqin» chegarasi (maketdagi «5 ta savol qoldi»). */
export const NEAR_LIMIT = 5;

export type LimitView = { used: number; limit: number; remaining: number; reached: boolean; near: boolean };

export const limitView = (access: AiAccessState): LimitView => ({
  used: access.usedToday,
  limit: access.dailyLimit,
  remaining: access.remainingToday,
  reached: access.remainingToday <= 0,
  near: access.remainingToday > 0 && access.remainingToday <= NEAR_LIMIT,
});

