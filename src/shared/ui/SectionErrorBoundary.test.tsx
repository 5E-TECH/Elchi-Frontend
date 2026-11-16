import { useQuery } from "@tanstack/react-query";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import { CardRow } from "../../widgets/dashboard-statistics/ui/DashboardGrid";
import SectionErrorBoundary, { SectionRetryScope } from "./SectionErrorBoundary";

/**
 * QKCeGZ3N (tester kuzatuvi 2026-10-30): «Qayta urinish» faqat chegarani tozalardi — bo'lim keshdagi o'sha buzilgan
 * javob bilan qayta chizilib, yana yiqilardi; javob tuzalgach ham sahifa yangilanmaguncha tiklanmasdi. Endi bo'lim
 * so'rovlari (`queryKeys` / `SectionRetryScope`) qayta yuboriladi.
 */
type Payload = { rows?: unknown };

/** Buzilgan javob (`rows` massiv emas) — prod'dagi «r.forEach is not a function» kabi chizishda yiqiladi. */
const Rows = ({ data, label }: { data: Payload | undefined; label: string }) => {
  if (!data) return <p>{label}: yuklanmoqda</p>;
  const rows = data.rows as string[];
  return <article aria-label={label}>{rows.map((row) => row.toUpperCase()).join(", ")}</article>;
};

const SECTION_ERROR = "Bu bo'limni ochishda xatolik yuz berdi";

describe("SectionErrorBoundary — «Qayta urinish» so'rovni qayta yuboradi (QKCeGZ3N)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("⭐ o'z so'rovi (`queryKeys`): javob tuzalgach «Qayta urinish» bo'limni tiklaydi", async () => {
    const fetchChart = vi
      .fn<() => Promise<Payload>>()
      .mockResolvedValueOnce({ rows: { broken: true } })
      .mockResolvedValue({ rows: ["tiklandi"] });
    const Chart = () => {
      const { data } = useQuery({ queryKey: ["chart", "today"], queryFn: fetchChart });
      return <Rows data={data} label="Grafik" />;
    };

    renderWithProviders(
      <SectionErrorBoundary queryKeys={[["chart"]]}>
        <Chart />
      </SectionErrorBoundary>,
    );

    expect(await screen.findByText(SECTION_ERROR)).toBeInTheDocument();
    expect(fetchChart).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Qayta urinish" }));

    expect(await screen.findByRole("article", { name: "Grafik" })).toHaveTextContent("TIKLANDI");
    expect(fetchChart).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(SECTION_ERROR)).toBeNull();
  });

  it("⭐ to'r (`CardRow`) + `SectionRetryScope`: ota so'rovi qayta yuboriladi, yonidagi karta yiqilmaydi", async () => {
    const fetchDashboard = vi
      .fn<() => Promise<Payload>>()
      .mockResolvedValueOnce({ rows: "buzilgan" })
      .mockResolvedValue({ rows: ["reyting"] });
    const Page = () => {
      // Ma'lumot otada (sahifa) — yiqilgan karta uni faqat props orqali oladi.
      const { data } = useQuery({ queryKey: ["dashboard", "admin:1"], queryFn: fetchDashboard });
      return (
        <CardRow>
          <article aria-label="Kassa">Kassa</article>
          <Rows data={data} label="Reyting" />
        </CardRow>
      );
    };

    renderWithProviders(
      <SectionRetryScope queryKeys={[["dashboard"]]}>
        <Page />
      </SectionRetryScope>,
    );

    expect(await screen.findByText(SECTION_ERROR)).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Kassa" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Qayta urinish" }));

    expect(await screen.findByRole("article", { name: "Reyting" })).toHaveTextContent("REYTING");
    expect(fetchDashboard).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("article", { name: "Kassa" })).toBeInTheDocument();
  });

  it("aniq `queryKeys` sahifa sukutidan ustun: boshqa so'rovlar qayta yuborilmaydi", async () => {
    const fetchDashboard = vi.fn<() => Promise<Payload>>().mockResolvedValue({ rows: ["kpi"] });
    const fetchRegion = vi
      .fn<() => Promise<Payload>>()
      .mockResolvedValueOnce({ rows: 1 })
      .mockResolvedValue({ rows: ["toshkent"] });
    const Dashboard = () => {
      const { data } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard });
      return <Rows data={data} label="KPI" />;
    };
    const Region = () => {
      const { data } = useQuery({ queryKey: ["region-stats", {}], queryFn: fetchRegion });
      return <Rows data={data} label="Hududlar" />;
    };

    renderWithProviders(
      <SectionRetryScope queryKeys={[["dashboard"]]}>
        <Dashboard />
        <SectionErrorBoundary queryKeys={[["region-stats"]]}>
          <Region />
        </SectionErrorBoundary>
      </SectionRetryScope>,
    );

    expect(await screen.findByText(SECTION_ERROR)).toBeInTheDocument();
    expect(await screen.findByRole("article", { name: "KPI" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Qayta urinish" }));

    expect(await screen.findByRole("article", { name: "Hududlar" })).toHaveTextContent("TOSHKENT");
    expect(fetchRegion).toHaveBeenCalledTimes(2);
    expect(fetchDashboard).toHaveBeenCalledTimes(1);
  });

  it("to'rdagi fragment (`<><A /><B /></>`) ochiladi — har karta o'z chegarasida", () => {
    const Broken = () => {
      throw new TypeError("r.forEach is not a function");
    };

    const { container } = renderWithProviders(
      <CardRow>
        <>
          <article aria-label="Muvaffaqiyat">Muvaffaqiyat</article>
          <Broken />
        </>
        <article aria-label="Sifat">Sifat</article>
      </CardRow>,
    );

    expect(screen.getByRole("article", { name: "Muvaffaqiyat" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Sifat" })).toBeInTheDocument();
    const grid = container.querySelector(".grid") as HTMLElement;
    expect(within(grid).getAllByText(SECTION_ERROR)).toHaveLength(1);
    // Chegara DOM qo'shmaydi: to'rning bolalari — kartalarning o'zi (xato kartasi ham).
    expect(grid.children).toHaveLength(3);
  });
});
