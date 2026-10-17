import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CircleCheck } from "lucide-react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import {
  ChartLegend,
  DeltaChip,
  Donut,
  Gauge,
  HBarList,
  Meter,
  RankList,
  RingStat,
  SegBar,
  successZoneTone,
  ViewToggle,
  Waterfall,
  type RankItem,
} from ".";

const dashLength = (el: Element) => Number(el.getAttribute("stroke-dasharray")?.split(" ")[0]);

describe("successZoneTone", () => {
  it("≥ 70 yaxshi, 40–70 o'rtacha, < 40 past (NaN — past)", () => {
    expect(successZoneTone(70)).toBe("success");
    expect(successZoneTone(69.9)).toBe("warning");
    expect(successZoneTone(40)).toBe("warning");
    expect(successZoneTone(39.9)).toBe("danger");
    expect(successZoneTone(Number.NaN)).toBe("danger");
  });
});

describe("Gauge", () => {
  it("qiymat, yorliq va zona badge'i; nuqta-marker; ichki ko'rsatkichlar", () => {
    const { container } = renderWithProviders(
      <Gauge
        value={77.2}
        label="Sotilgan / qabul qilingan"
        ariaLabel="Muvaffaqiyat darajasi: 77,2%"
        marker={{ value: 74.8, label: "Kecha" }}
        stats={[{ key: "s", value: "241 ta", label: "Sotilgan", tone: "success", icon: CircleCheck }]}
      />,
    );
    const figure = screen.getByRole("img", { name: "Muvaffaqiyat darajasi: 77,2%" });
    expect(within(figure).getByText("77,2%")).toBeInTheDocument();
    expect(within(figure).getByText("Yaxshi · 70% va undan yuqori")).toBeInTheDocument();
    expect(within(figure).getByText("241 ta")).toBeInTheDocument();
    expect(container.querySelector("[data-gauge-marker]")).not.toBeNull();
  });

  it("qiymat 0..100 ga qisiladi va zona o'zgaradi", () => {
    renderWithProviders(<Gauge value={140} label="x" ariaLabel="a" />);
    expect(screen.getByText("100%")).toBeInTheDocument();
    renderWithProviders(<Gauge value={35} label="x" ariaLabel="b" />);
    expect(screen.getByText("Past · 40% dan kam")).toBeInTheDocument();
    renderWithProviders(<Gauge value={55} label="x" ariaLabel="c" />);
    expect(screen.getByText("O'rtacha · 40–70%")).toBeInTheDocument();
  });
});

describe("Donut", () => {
  it("har nolga teng bo'lmagan bo'lak — qiymatga mutanosib yoy; legenda-jadval (ta + %)", () => {
    const { container } = renderWithProviders(
      <Donut
        ariaLabel="Holatlar"
        centerLabel="Jami qabul qilingan"
        total={312}
        segments={[
          { key: "sold", label: "Sotilgan", value: 241, tone: "success" },
          { key: "progress", label: "Jarayonda", value: 46, tone: "warning" },
          { key: "cancelled", label: "Bekor qilingan", value: 25, tone: "danger" },
        ]}
      />,
    );
    const sold = container.querySelector('[data-donut-segment="sold"]')!;
    const cancelled = container.querySelector('[data-donut-segment="cancelled"]')!;
    expect(dashLength(sold) / dashLength(cancelled)).toBeGreaterThan(9);
    expect(screen.getByText("312")).toBeInTheDocument();
    const legend = screen.getByRole("list", { name: "Holatlar" });
    expect(within(legend).getByText("241 ta")).toBeInTheDocument();
    expect(within(legend).getByText("77,2%")).toBeInTheDocument();
  });

  it("nol bo'laklar chizilmaydi; hammasi nol — faqat iz", () => {
    const { container } = renderWithProviders(
      <Donut
        ariaLabel="Bo'sh"
        centerLabel="Jami"
        segments={[
          { key: "a", label: "A", value: 0, tone: "success" },
          { key: "b", label: "B", value: 0, tone: "danger" },
        ]}
      />,
    );
    expect(container.querySelectorAll("[data-donut-segment]")).toHaveLength(0);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});

const items = (count: number): RankItem[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `m${index}`,
    name: `Market ${index + 1}`,
    value: `${90 - index}%`,
    sub: `${index} / 10 ta`,
    share: 90 - index,
  }));

describe("RankList", () => {
  it("limit qator, telefondan ortiqlari yashirin; «Yana ko'rsatish» hammasini ochadi, «Kamroq» qaytaradi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RankList ariaLabel="Top marketlar" items={items(12)} limit={5} mobileLimit={3} expandable />);
    const list = screen.getByRole("list", { name: "Top marketlar" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    expect(rows[3]).toHaveClass("max-md:hidden");
    expect(rows[2]).not.toHaveClass("max-md:hidden");

    await user.click(screen.getByRole("button", { name: /Yana ko'rsatish · 7 ta/ }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(12);
    await user.click(screen.getByRole("button", { name: "Kamroq ko'rsatish" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
  });

  it("limitdan oshmasa (telefonda ham) — tugma yo'q", () => {
    renderWithProviders(<RankList ariaLabel="Top" items={items(3)} limit={5} mobileLimit={3} expandable />);
    expect(screen.queryByRole("button", { name: /Yana ko'rsatish/ })).not.toBeInTheDocument();
  });

  it("ochilganda boshqa to'liq ro'yxat (`expandedItems`) ko'rsatiladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <RankList ariaLabel="Top" items={items(5)} expandedItems={items(9)} limit={5} expandable />,
    );
    await user.click(screen.getByRole("button", { name: /Yana ko'rsatish · 4 ta/ }));
    expect(screen.getByText("Market 9")).toBeInTheDocument();
  });

  it("pinned qator ro'yxatdan tashqari, o'z o'rni va badge bilan", () => {
    renderWithProviders(
      <RankList
        ariaLabel="Top filiallar"
        items={items(5)}
        pinned={{ id: "own", name: "Urgut filiali", value: "67,4%", rank: 6, badge: { label: "Sizning filial", tone: "neutral", outline: true } }}
      />,
    );
    const lists = screen.getAllByRole("list", { name: "Top filiallar" });
    expect(lists).toHaveLength(2);
    expect(within(lists[1]).getByText("Urgut filiali")).toBeInTheDocument();
    expect(within(lists[1]).getByText("6")).toBeInTheDocument();
    expect(within(lists[1]).getByText("Sizning filial")).toBeInTheDocument();
  });

  it("bosiladigan qator — ism tugma bo'ladi", async () => {
    const user = userEvent.setup();
    let clicked = "";
    renderWithProviders(
      <RankList ariaLabel="Hududlar" items={[{ id: "r1", name: "Toshkent sh.", value: "112 ta", onClick: () => (clicked = "r1") }]} />,
    );
    await user.click(screen.getByRole("button", { name: "Toshkent sh." }));
    expect(clicked).toBe("r1");
  });
});

describe("Meter / SegBar / HBarList / RingStat / Waterfall", () => {
  it("Meter: to'ldirish foizi va maqsad chizig'i", () => {
    const { container } = renderWithProviders(<Meter value={40} max={80} target={60} ariaLabel="Reja" />);
    const meter = screen.getByRole("meter", { name: "Reja" });
    expect((meter.firstElementChild as HTMLElement).style.width).toBe("50%");
    expect((container.querySelector("[data-meter-target]") as HTMLElement).style.left).toBe("75%");
  });

  it("SegBar: nol bo'lak chizilmaydi, legenda foizi", () => {
    const { container } = renderWithProviders(
      <SegBar
        ariaLabel="Paketlar"
        segments={[
          { key: "a", label: "Yo'ldagi paketlar", value: 3, tone: "warning" },
          { key: "b", label: "Qabul kutayotganlar", value: 2, tone: "info" },
          { key: "c", label: "Boshqa", value: 0, tone: "neutral" },
        ]}
      />,
    );
    expect(container.querySelectorAll("[data-segbar-segment]")).toHaveLength(2);
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("HBarList: limit + «Yana ko'rsatish», badge «Siz»", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <HBarList
        ariaLabel="Sotuv foizi"
        limit={2}
        expandable
        max={100}
        rows={[
          { id: "a", label: "Nur", value: 81.6, display: "81,6%" },
          { id: "b", label: "Baraka", value: 79.7, display: "79,7%", badge: "Siz" },
          { id: "c", label: "Ipak", value: 79.4, display: "79,4%" },
        ]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Siz")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Yana ko'rsatish · 1 ta/ }));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("RingStat: halqa ichida butun foiz, yonida qiymat", () => {
    renderWithProviders(<RingStat value={86.4} label="O'z vaqtida (SLA)" valueText="86,4%" />);
    expect(screen.getByText("86%")).toBeInTheDocument();
    expect(screen.getByText("86,4%")).toBeInTheDocument();
  });

  it("Waterfall: kassa + yo'ldagi − marketlar = joriy (yorliqlar ishorali)", () => {
    const { container } = renderWithProviders(
      <Waterfall
        ariaLabel="Kassa"
        steps={[
          { key: "main", label: "Pochta kassasi", value: 24_600_000, kind: "start" },
          { key: "transit", label: "Yo'ldagi pul", value: 11_400_000, kind: "up" },
          { key: "markets", label: "Marketlar", value: 13_500_000, kind: "down" },
          { key: "current", label: "Joriy holat", value: 22_500_000, kind: "total" },
        ]}
      />,
    );
    expect(screen.getByRole("img", { name: "Kassa" })).toBeInTheDocument();
    expect(screen.getByText("+11,4 mln")).toBeInTheDocument();
    expect(screen.getByText("−13,5 mln")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-wf-bar]")).toHaveLength(4);
  });
});

describe("DeltaChip / ChartLegend / ViewToggle", () => {
  it("DeltaChip: yo'nalish × yaxshi/yomon", () => {
    renderWithProviders(
      <>
        <DeltaChip value={6.4} />
        <DeltaChip value={-0.9} goodWhen="down" text="−0,9 p.p." />
      </>,
    );
    expect(screen.getByText("+6,4%")).toHaveClass("bg-success-soft");
    expect(screen.getByText("−0,9 p.p.")).toHaveClass("bg-success-soft");
  });

  it("ChartLegend: matn matn tokenida, belgi alohida", () => {
    renderWithProviders(<ChartLegend items={[{ key: "a", label: "Yaxshi chegarasi · 70%", tone: "success" }]} />);
    expect(screen.getByText("Yaxshi chegarasi · 70%")).toBeInTheDocument();
  });

  it("ViewToggle: «Grafik | Jadval» radio guruhi", async () => {
    const user = userEvent.setup();
    let value = "chart";
    renderWithProviders(<ViewToggle value="chart" onChange={(next) => (value = next)} />);
    expect(screen.getByRole("radiogroup", { name: "Ko'rinish" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Jadval" }));
    expect(value).toBe("table");
  });
});

describe("shared/ui/charts — recharts'ga bog'liq emas (dashboard byudjeti)", () => {
  it("hech bir fayl recharts import qilmaydi", () => {
    const sources = import.meta.glob("./*.{ts,tsx}", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
    const offenders = Object.entries(sources)
      .filter(([path]) => !path.endsWith(".test.tsx"))
      .filter(([, source]) => /from\s+["']recharts["']|from\s+["']highcharts/.test(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
