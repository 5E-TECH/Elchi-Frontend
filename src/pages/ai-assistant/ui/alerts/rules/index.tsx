import type { ReactNode } from "react";
import type { AiAdvisorAlertDetail } from "../../../../../entities/ai-advisor";
import { GenericBody } from "./GenericBody";
import { ReceiptCheckBody } from "./ReceiptCheckBody";
import { ShiftShortageBody } from "./ShiftShortageBody";
import type { KnownAlertDetail } from "./types";

/**
 * Qoida bo'yicha oyna tanasi (faktlar + dalillar). R1 «Smena kamomadi» va R7 «Chek yoki karta farqi» — o'z
 * ko'rinishi; qolganlari (R2–R6, R8 — keyingi bosqich) va noma'lum qoida — `GenericBody`.
 */
export const renderRuleBody = (alert: AiAdvisorAlertDetail): ReactNode => {
  if (alert.facts === null) return <GenericBody alert={alert} />;
  switch (alert.rule_key) {
    case "R1":
      return <ShiftShortageBody alert={alert as KnownAlertDetail<"R1">} />;
    case "R7":
      return <ReceiptCheckBody alert={alert as KnownAlertDetail<"R7">} />;
    default:
      return <GenericBody alert={alert} />;
  }
};
