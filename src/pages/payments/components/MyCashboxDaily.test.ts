import { describe, expect, it } from "vitest";
import { buildFlowSteps } from "./MyCashboxDaily";
import type { PaymentRow } from "./patmentHistoryTable";

const row = (source_type: string, operation_type: string, amount: number) =>
  ({ id: source_type, source_type, operation_type, amount }) as unknown as PaymentRow;

const labels = { income: "Kirim", expense: "Chiqim", other: "Boshqa" };
const sourceLabel = (sourceType: string) => sourceType;

describe("buildFlowSteps (qzjTMWPb)", () => {
  it("qatorlar server jamiga teng — manbalar bo'yicha, ortig'i «Boshqa»", () => {
    const steps = buildFlowSteps({
      rows: [
        row("sell", "income", 500),
        row("courier_payment", "expense", 300),
        row("cancel", "expense", 100),
        row("extra_cost", "expense", 40),
      ],
      income: 500,
      expense: 440,
      sourceLabel,
      labels,
    });
    expect(steps.map((step) => [step.label, step.kind, step.value])).toEqual([
      ["sell", "up", 500],
      ["courier_payment", "down", 300],
      ["cancel", "down", 100],
      ["Boshqa", "down", 40],
    ]);
  });

  it("qatorlar to'liq emas — bitta Kirim / Chiqim (yolg'on taqsimot yo'q)", () => {
    const steps = buildFlowSteps({ rows: [row("sell", "income", 100)], income: 500, expense: 40, sourceLabel, labels });
    expect(steps.map((step) => [step.label, step.value])).toEqual([
      ["Kirim", 500],
      ["Chiqim", 40],
    ]);
  });
});
