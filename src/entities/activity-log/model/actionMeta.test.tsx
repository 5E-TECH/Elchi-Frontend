import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ActivityActionBadge from "../ui/ActivityActionBadge";
import { actionBadgeTone, actionVerbTone, humanizeAction, resolveActionMeta } from "./actionMeta";
import type { ActivityActionMeta } from "./types";

const meta = (over: Partial<ActivityActionMeta> = {}): ActivityActionMeta => ({
  action: "finance.manual_expense",
  label: "Qo'lda chiqim",
  category: "finance",
  categoryLabel: "Moliya",
  icon: "minus",
  tone: "rose",
  known: true,
  ...over,
});

describe("activity-log amal yorlig'i va toni (y8CxCtcK)", () => {
  it.each([
    ["green", "success"],
    ["emerald", "success"],
    ["rose", "danger"],
    ["red", "danger"],
    ["amber", "warning"],
    ["orange", "warning"],
    ["blue", "info"],
    ["sky", "info"],
    ["violet", "info"],
    ["slate", "neutral"],
    ["gray", "neutral"],
    ["success", "success"],
    [" Rose ", "danger"],
  ])("BeePost toni %s → badge %s", (tone, expected) => {
    expect(actionBadgeTone(tone)).toBe(expected);
  });

  it("noma'lum yoki bo'sh ton — neytral", () => {
    expect(actionBadgeTone("fuchsia-ish")).toBe("neutral");
    expect(actionBadgeTone(null)).toBe("neutral");
    expect(actionBadgeTone(undefined)).toBe("neutral");
  });

  it("humanize — gap registri", () => {
    expect(humanizeAction("order.sell")).toBe("Order sell");
    expect(humanizeAction("finance.manual_expense")).toBe("Finance manual expense");
    expect(humanizeAction("")).toBe("");
  });

  it("manba tartibi: qatordagi `action_meta` → reyestr → humanize", () => {
    const registry = new Map([["order.sell", meta({ action: "order.sell", label: "Sotildi", tone: "green" })]]);
    expect(resolveActionMeta({ action: "order.sell", action_meta: meta({ label: "Qatordagi", tone: "amber" }) }, registry)).toEqual({
      label: "Qatordagi",
      tone: "warning",
    });
    expect(resolveActionMeta({ action: "order.sell", action_meta: null }, registry)).toEqual({ label: "Sotildi", tone: "success" });
    expect(resolveActionMeta({ action: "order.batch_sent", action_meta: null }, registry)).toEqual({
      label: "Order batch sent",
      tone: "neutral",
    });
  });

  it("badge: o'zbekcha yorliq va ton klassi; ikona yo'q (maketda yo'q)", () => {
    render(<ActivityActionBadge action="finance.manual_expense" meta={meta()} />);
    const badge = screen.getByText("Qo'lda chiqim").parentElement!;
    expect(badge).toHaveClass("bg-danger-soft", "text-danger-fg");
    expect(badge.querySelector("svg")).toBeNull();
  });

  it("juda uzun yorliq — badge qator eniga sig'adi («…»), to'liq matn `title` da", () => {
    const label = "Notification telegram group member joined the regional channel";
    render(<ActivityActionBadge action="notification.tg_joined" meta={meta({ action: "notification.tg_joined", label, tone: "slate", known: false })} />);
    const text = screen.getByText(label);
    expect(text).toHaveClass("min-w-0", "truncate");
    expect(text.parentElement).toHaveClass("max-w-full");
    expect(text.parentElement).toHaveAttribute("title", label);
  });

  it("reyestrda yo'q eski fe'l — backend yorlig'i, neytral; yorliqsiz — fe'ldan humanize", () => {
    const { rerender } = render(
      <ActivityActionBadge action="order.batch_sent" meta={meta({ action: "order.batch_sent", label: "Order batch sent", tone: "slate", known: false })} />,
    );
    expect(screen.getByText("Order batch sent").parentElement).toHaveClass("bg-sunken");
    rerender(<ActivityActionBadge action="custody_changed" />);
    expect(screen.getByText("Custody changed")).toBeInTheDocument();
    rerender(<ActivityActionBadge action="" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("ton umuman kelmasa (eski backend) — fe'l kalit so'zi bo'yicha (G2 §3.1); backend toni bo'lsa u ustun", () => {
    expect(actionVerbTone("deleted")).toBe("danger");
    expect(actionVerbTone("order.cancel")).toBe("danger");
    expect(actionVerbTone("finance.settle_market")).toBe("success");
    expect(actionVerbTone("created")).toBe("info");
    expect(actionVerbTone("assign")).toBe("info");
    expect(actionVerbTone("status_change")).toBe("neutral");
    const registry = new Map([["deleted", meta({ action: "deleted", label: "O'chirildi", tone: null })]]);
    expect(resolveActionMeta({ action: "deleted", action_meta: null }, registry)).toEqual({ label: "O'chirildi", tone: "danger" });
    expect(resolveActionMeta({ action: "deleted", action_meta: meta({ action: "deleted", label: "O'chirildi", tone: "slate" }) })).toEqual({
      label: "O'chirildi",
      tone: "neutral",
    });
    render(<ActivityActionBadge action="deleted" label="Удалено" />);
    expect(screen.getByText("Удалено").parentElement).toHaveAttribute("data-tone", "danger");
  });
});
