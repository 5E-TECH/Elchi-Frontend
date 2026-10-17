import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import type { RankingMeta, TopMarket } from "../../../entities/dashboard";
import { rankingPeriodLabel } from "../model/ranking";
import { RankingCard } from "./RankingCard";

const row = (index: number, over: Partial<TopMarket> = {}): TopMarket => ({
  market_id: `m-${index}`,
  market_name: `Market ${index} Savdo`,
  success_rate: 90 - index,
  successful_orders: 40 - index,
  total_orders: 45,
  ...over,
});
const rows = (count: number) => Array.from({ length: count }, (_, index) => row(index + 1));

const meta = (over: Partial<RankingMeta>): RankingMeta => ({
  periodRule: null,
  periodDays: null,
  from: null,
  to: null,
  minOrders: 1,
  ...over,
});

const items = () => within(screen.getByRole("list", { name: "Top marketlar" })).getAllByRole("listitem");

describe("RankingCard (9zbSDkUI, `superadmin-dashboard-main`)", () => {
  it("qator: o'rin, bosh harflar, nom, sotuv foizi chizig'i, foiz va sotilgan / jami", () => {
    renderWithProviders(
      <RankingCard title="Top marketlar" markets={[row(0, { market_name: "Baraka Shop", success_rate: 84.4, successful_orders: 38, total_orders: 45 })]} />,
    );

    const [first] = items();
    expect(first).toHaveTextContent("1");
    expect(within(first).getByText("BS")).toHaveAttribute("aria-hidden", "true");
    expect(within(first).getByText("Baraka Shop")).toBeInTheDocument();
    expect(within(first).getByRole("meter", { name: "Baraka Shop: sotuv foizi" })).toHaveAttribute("aria-valuenow", "84.4");
    expect(first).toHaveTextContent("84,4%");
    expect(first).toHaveTextContent("38 / 45 ta");
    expect(screen.getByRole("heading", { level: 2, name: "Top marketlar" })).toBeInTheDocument();
  });

  it("izohda davr: last_30_days — «oxirgi 30 kun», selected_range — sanalar, meta yo'q — faqat formula", () => {
    const { rerender } = renderWithProviders(
      <RankingCard title="Top marketlar" markets={rows(1)} meta={meta({ periodRule: "last_30_days", periodDays: 30 })} />,
    );
    expect(screen.getByText("Sotuv foizi · sotilgan / jami · oxirgi 30 kun")).toBeInTheDocument();

    rerender(
      <RankingCard
        title="Top marketlar"
        markets={rows(1)}
        meta={meta({ periodRule: "selected_range", from: "2026-10-12T07:00:00.000Z", to: "2026-10-15T07:00:00.000Z" })}
      />,
    );
    expect(screen.getByText("Sotuv foizi · sotilgan / jami · 12.10 – 15.10.2026")).toBeInTheDocument();

    rerender(<RankingCard title="Top marketlar" markets={rows(1)} meta={null} />);
    expect(screen.getByText("Sotuv foizi · sotilgan / jami")).toBeInTheDocument();
  });

  it("rankingPeriodLabel: noma'lum qoida va sanasiz meta — davr yozilmaydi", () => {
    const label = (count: number) => `oxirgi ${count} kun`;
    expect(rankingPeriodLabel(meta({ periodRule: "last_30_days" }), label)).toBe("oxirgi 30 kun");
    expect(rankingPeriodLabel(meta({ periodRule: "all_time" }), label)).toBeNull();
    expect(rankingPeriodLabel(meta({ periodRule: "selected_range", from: "yaroqsiz", to: "2026-10-15" }), label)).toBeNull();
    expect(rankingPeriodLabel(undefined, label)).toBeNull();
    // «Barchasi»: filtr 1970-01-01 dan — «01.01.1970 – …» emas, davr yozilmaydi.
    expect(
      rankingPeriodLabel(meta({ periodRule: "selected_range", from: "1970-01-01T00:00:00+05:00", to: "2026-10-17T23:59:59+05:00" }), label),
    ).toBeNull();
    expect(
      rankingPeriodLabel(meta({ periodRule: "selected_range", from: "1969-12-31T19:00:00.000Z", to: "2026-10-17T12:00:00.000Z" }), label),
    ).toBeNull();
  });

  it("8 qator: desktopda 5, telefonda 3 ko'rinadi; «Yana ko'rsatish» hammasini ochadi va yig'adi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RankingCard title="Top marketlar" markets={rows(8)} />);

    const list = items();
    expect(list).toHaveLength(8);
    expect(list.slice(0, 3).every((item) => !/hidden/.test(item.className))).toBe(true);
    expect(list[3]).toHaveClass("max-md:hidden");
    expect(list[4]).toHaveClass("max-md:hidden");
    expect(list.slice(5).every((item) => item.classList.contains("hidden"))).toBe(true);

    const more = screen.getByRole("button", { name: /Yana ko'rsatish/ });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(within(more).getByText("Yana ko'rsatish · 3 ta")).toHaveClass("max-md:hidden");
    expect(within(more).getByText("Yana ko'rsatish · 5 ta")).toHaveClass("md:hidden");
    expect(more).not.toHaveClass("md:hidden");

    await user.click(more);
    expect(items().every((item) => !/hidden/.test(item.className))).toBe(true);
    const less = screen.getByRole("button", { name: "Kamroq ko'rsatish" });
    expect(less).toHaveAttribute("aria-expanded", "true");

    await user.click(less);
    expect(items()[5]).toHaveClass("hidden");
  });

  it("4 qator: tugma faqat telefonda (desktopda hammasi sig'adi)", () => {
    renderWithProviders(<RankingCard title="Top marketlar" markets={rows(4)} />);
    const more = screen.getByRole("button", { name: /Yana ko'rsatish/ });
    expect(more).toHaveClass("md:hidden");
    expect(within(more).getByText("Yana ko'rsatish · 1 ta")).toBeInTheDocument();
  });

  it("3 qator va 30+ buyurtma: tugma ham, «kam ma'lumot» eslatmasi ham yo'q", () => {
    renderWithProviders(<RankingCard title="Top marketlar" markets={rows(3)} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/Ma'lumot hali kam/)).not.toBeInTheDocument();
  });

  it("«Kam ma'lumot» (taxta `tizim-charts`): 30 dan kam buyurtmali qator bo'lsa — reyting + eslatma", () => {
    renderWithProviders(<RankingCard title="Top marketlar" markets={[row(1), row(2, { total_orders: 18, successful_orders: 13 })]} />);
    expect(items()).toHaveLength(2);
    expect(screen.getByText("Ma'lumot hali kam — reyting natijalari o'zgarishi mumkin")).toBeInTheDocument();
  });

  it("davr Toshkent kuni bo'yicha — brauzer zonasi (UTC) boshlanishni bir kun oldin ko'rsatmaydi", () => {
    const label = (count: number) => `oxirgi ${count} kun`;
    // Backend: «Bu hafta» = 12.10 00:00 – 15.10 23:59 Toshkent.
    expect(
      rankingPeriodLabel(
        meta({ periodRule: "selected_range", from: "2026-10-11T19:00:00.000Z", to: "2026-10-15T18:59:59.999Z" }),
        label,
      ),
    ).toBe("12.10 – 15.10.2026");
    expect(rankingPeriodLabel(meta({ periodRule: "selected_range", from: "2026-10-12", to: "2026-10-15" }), label)).toBe(
      "12.10 – 15.10.2026",
    );
  });

  it("yuklanishda — qatorlar skeleti (telefonda 3 ta), «buyurtma yo'q» bo'sh holati emas", () => {
    renderWithProviders(<RankingCard data-testid="card" title="Top marketlar" markets={[]} loading />);
    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("aria-busy", "true");
    expect(card).not.toHaveAttribute("data-empty");
    expect(card).not.toHaveClass("self-start");
    expect(screen.queryByText("Bu davrda reyting uchun buyurtma yo'q")).not.toBeInTheDocument();
    const skeleton = screen.getByTestId("ranking-skeleton");
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    expect(skeleton.querySelectorAll("li")).toHaveLength(5);
    expect(skeleton.querySelectorAll("li.max-md\\:hidden")).toHaveLength(2);
  });

  it("bo'sh: ixcham EmptyState, karta qo'shnisiga cho'zilmaydi, «30 buyurtma» matni yo'q", () => {
    renderWithProviders(<RankingCard data-testid="card" title="Top filiallar" branches={[]} />);
    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("data-empty");
    expect(card).toHaveClass("self-start");
    expect(card.querySelector('[data-state-size="inline"]')).toHaveTextContent("Bu davrda reyting uchun buyurtma yo'q");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText(/30/)).not.toBeInTheDocument();
  });

  it("menejer: o'z filiali top 5 ichida — «Sizning filial» belgisi qatorda", () => {
    renderWithProviders(<RankingCard title="Top marketlar" markets={rows(3)} ownId="m-2" />);
    const [, second] = items();
    expect(second).toHaveAttribute("data-own");
    expect(within(second).getByText("Sizning filial")).toBeInTheDocument();
  });

  it("menejer: o'z filiali 7-o'rinda — ro'yxat ostida alohida, doim ko'rinadi (`manager-branch-dashboard-main`)", () => {
    renderWithProviders(<RankingCard title="Top marketlar" markets={rows(8)} ownId="m-7" />);
    expect(items()).toHaveLength(7);
    expect(items().some((item) => item.textContent?.includes("Market 7 Savdo"))).toBe(false);

    const own = screen.getByRole("list", { name: "Sizning filialingiz o'rni" });
    expect(own).toHaveAttribute("start", "7");
    const [pinned] = within(own).getAllByRole("listitem");
    expect(pinned).not.toHaveClass("hidden");
    expect(pinned).toHaveTextContent("7");
    expect(pinned).toHaveTextContent("Market 7 Savdo");
    expect(pinned).toHaveTextContent("Sizning filial");
    // Asosiy ro'yxatda 7 qator: desktopda 2 tasi yashirin.
    expect(screen.getByText("Yana ko'rsatish · 2 ta")).toBeInTheDocument();
  });
});
