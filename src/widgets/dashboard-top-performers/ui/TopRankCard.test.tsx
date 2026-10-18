import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import type { TopMarket } from "../../../entities/dashboard";
import { EmptyState } from "../../../shared/ui/primitives";
import { renderWithProviders } from "../../../test/test-utils";
import { marketRows, toRankItems } from "../lib/rankItems";
import TopRankCard from "./TopRankCard";

/**
 * «Top marketlar / filiallar» reyting kartasi (9zbSDkUI, `superadmin-dashboard-main`,
 * `manager-branch-dashboard-main`). Dev'dagi `RankingCard` xulqlari (qator, «Yana ko'rsatish», telefonda
 * 3 qator, bo'sh karta ixcham, o'z filiali alohida qatorda) yagona v2 karta — `TopRankCard` da tekshiriladi.
 */

const row = (index: number, over: Partial<TopMarket> = {}): TopMarket => ({
  market_id: `m-${index}`,
  market_name: `Market ${index} Savdo`,
  success_rate: 90 - index,
  successful_orders: 40 - index,
  total_orders: 45,
  ...over,
});
const rows = (count: number) => Array.from({ length: count }, (_, index) => row(index + 1));

const t = i18n.getFixedT("uz", "dashboard") as unknown as TFunction;
const toItems = (markets: TopMarket[], selfId?: string) =>
  toRankItems(marketRows(markets), {
    t,
    language: "uz",
    selfId,
    selfBadge: selfId ? { label: "Sizning filial", tone: "neutral", outline: true } : undefined,
  });

const renderCard = (markets: TopMarket[], extra: Partial<Parameters<typeof TopRankCard>[0]> = {}) =>
  renderWithProviders(
    <TopRankCard
      data-testid="card"
      title="Top marketlar"
      description="Sotuv foizi · sotilgan / jami"
      items={toItems(markets)}
      expandable
      empty={<EmptyState size="chart" title="Reyting uchun ma'lumot hali kam" />}
      {...extra}
    />,
  );

const items = () => within(screen.getAllByRole("list", { name: "Top marketlar" })[0]).getAllByRole("listitem");

describe("TopRankCard (9zbSDkUI)", () => {
  it("qator: o'rin, bosh harflar, nom, sotuv foizi chizig'i, foiz va sotilgan / jami", () => {
    renderCard([row(0, { market_name: "Baraka Shop", success_rate: 84.4, successful_orders: 38, total_orders: 45 })]);

    const [first] = items();
    expect(first).toHaveTextContent("1");
    expect(within(first).getByText("BS")).toHaveAttribute("aria-hidden", "true");
    expect(within(first).getByText("Baraka Shop")).toBeInTheDocument();
    expect(first.querySelector("[style*='width: 84.4%']")).not.toBeNull();
    expect(first).toHaveTextContent("84,4%");
    expect(first).toHaveTextContent("38 / 45 ta");
    expect(screen.getByRole("heading", { level: 2, name: "Top marketlar" })).toBeInTheDocument();
  });

  it("8 qator: 5 ko'rinadi (telefonda 3); «Yana ko'rsatish» hammasini ochadi va yig'adi", async () => {
    const user = userEvent.setup();
    renderCard(rows(8));

    const list = items();
    expect(list).toHaveLength(5);
    expect(list.slice(0, 3).every((item) => !/hidden/.test(item.className))).toBe(true);
    expect(list[3]).toHaveClass("max-md:hidden");
    expect(list[4]).toHaveClass("max-md:hidden");

    const more = screen.getByRole("button", { name: /Yana ko'rsatish/ });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(within(more).getByText("Yana ko'rsatish · 3 ta")).toHaveClass("max-md:hidden");
    expect(within(more).getByText("Yana ko'rsatish · 5 ta")).toHaveClass("md:hidden");
    expect(more).not.toHaveClass("md:hidden");

    await user.click(more);
    expect(items()).toHaveLength(8);
    expect(items().every((item) => !/hidden/.test(item.className))).toBe(true);
    const less = screen.getByRole("button", { name: "Kamroq ko'rsatish" });
    expect(less).toHaveAttribute("aria-expanded", "true");

    await user.click(less);
    expect(items()).toHaveLength(5);
  });

  it("4 qator: tugma faqat telefonda (desktopda hammasi sig'adi)", () => {
    renderCard(rows(4));
    const more = screen.getByRole("button", { name: /Yana ko'rsatish/ });
    expect(more).toHaveClass("md:hidden");
    expect(within(more).getByText("Yana ko'rsatish · 1 ta")).toBeInTheDocument();
  });

  it("3 qator: tugma yo'q; izoh faqat `note` berilganda", () => {
    const { unmount } = renderCard(rows(3));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/Ma'lumot hali kam/)).not.toBeInTheDocument();
    unmount();

    renderCard(rows(3), { note: "Ma'lumot hali kam — reyting natijalari o'zgarishi mumkin" });
    expect(screen.getByText("Ma'lumot hali kam — reyting natijalari o'zgarishi mumkin")).toBeInTheDocument();
  });

  it("bo'sh: EmptyState, karta qo'shnisiga cho'zilmaydi (`data-empty`, `self-start`), «30 buyurtma» matni yo'q", () => {
    renderCard([]);
    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("data-empty");
    expect(card).toHaveClass("self-start");
    expect(card).toHaveTextContent("Reyting uchun ma'lumot hali kam");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText(/30/)).not.toBeInTheDocument();
  });

  it("qatorli karta — `data-empty` yo'q, cho'ziladi", () => {
    renderCard(rows(2));
    expect(screen.getByTestId("card")).not.toHaveAttribute("data-empty");
    expect(screen.getByTestId("card")).not.toHaveClass("self-start");
  });

  it("menejer: o'z filiali top 5 ichida — «Sizning filial» belgisi qatorda", () => {
    renderCard([], { items: toItems(rows(3), "m-2") });
    const [, second] = items();
    expect(second).toHaveAttribute("data-highlight");
    expect(within(second).getByText("Sizning filial")).toBeInTheDocument();
  });

  it("menejer: o'z filiali 7-o'rinda — ro'yxat ostida alohida, doim ko'rinadi (`manager-branch-dashboard-main`)", () => {
    const all = rows(8);
    const pinned = toRankItems(marketRows([all[6]]), {
      t,
      language: "uz",
      selfId: "m-7",
      selfBadge: { label: "Sizning filial", tone: "neutral", outline: true },
      startRank: 7,
    })[0];
    renderCard([], { items: toItems(all.slice(0, 5)), pinned, pinnedLabel: "Sizning filialingiz o'rni", expandable: false });

    expect(items()).toHaveLength(5);
    expect(items().some((item) => item.textContent?.includes("Market 7 Savdo"))).toBe(false);
    const own = screen.getByRole("list", { name: "Sizning filialingiz o'rni" });
    expect(own).toHaveAttribute("start", "7");
    const [pinnedRow] = within(own).getAllByRole("listitem");
    expect(pinnedRow).not.toHaveClass("hidden");
    expect(pinnedRow).toHaveTextContent("7");
    expect(pinnedRow).toHaveTextContent("Market 7 Savdo");
    expect(pinnedRow).toHaveTextContent("Sizning filial");
  });
});
