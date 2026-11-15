import type { ReactNode } from "react";
import type { AiAdvisorAlertDetail } from "../../../../../entities/ai-advisor";
import { CorrectionsBody } from "./CorrectionsBody";
import { CourierDebtBody } from "./CourierDebtBody";
import { ExpenseBody } from "./ExpenseBody";
import { GenericBody } from "./GenericBody";
import { HqTransferBody } from "./HqTransferBody";
import { LossBody } from "./LossBody";
import { MarketPayoutBody } from "./MarketPayoutBody";
import { ReceiptCheckBody } from "./ReceiptCheckBody";
import { ShiftShortageBody } from "./ShiftShortageBody";
import type { KnownAlertDetail } from "./types";

/**
 * Qoida bo'yicha oyna tanasi (faktlar + o'lchagich + dalillar): R1 «Smena kamomadi», R2 «Kuryer qarzi o'smoqda», R3
 * «G'ayrioddiy xarajat», R4 «Market to'lovi kechikmoqda», R5 «HQ'ga o'tkazma kechikmoqda», R6 «Zarar», R7 «Chek yoki
 * karta farqi», R8 «Tuzatishlar ko'paydi» — har biri o'z maketidagidek (faqat shartnoma v0.3 maydonlari). Noma'lum
 * qoida yoki buzilgan `facts` — `GenericBody` (server `title`, D14).
 */
export const renderRuleBody = (alert: AiAdvisorAlertDetail): ReactNode => {
  if (alert.facts === null) return <GenericBody alert={alert} />;
  switch (alert.rule_key) {
    case "R1":
      return <ShiftShortageBody alert={alert as KnownAlertDetail<"R1">} />;
    case "R2":
      return <CourierDebtBody alert={alert as KnownAlertDetail<"R2">} />;
    case "R3":
      return <ExpenseBody alert={alert as KnownAlertDetail<"R3">} />;
    case "R4":
      return <MarketPayoutBody alert={alert as KnownAlertDetail<"R4">} />;
    case "R5":
      return <HqTransferBody alert={alert as KnownAlertDetail<"R5">} />;
    case "R6":
      return <LossBody alert={alert as KnownAlertDetail<"R6">} />;
    case "R7":
      return <ReceiptCheckBody alert={alert as KnownAlertDetail<"R7">} />;
    case "R8":
      return <CorrectionsBody alert={alert as KnownAlertDetail<"R8">} />;
    default:
      return <GenericBody alert={alert} />;
  }
};
