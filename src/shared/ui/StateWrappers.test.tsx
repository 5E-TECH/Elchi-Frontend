import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Scale } from "lucide-react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import EmptyState from "./EmptyState";
import Loader from "./Loader";
import PageLoader from "./PageLoader";
import QueryErrorState from "./QueryErrorState";
import TableSkeleton from "./TableSkeleton";
import { SKELETON_DELAY_MS } from "./primitives/useLoadingPhase";

/**
 * v1 holat komponentlari (EmptyState, QueryErrorState, TableSkeleton, Loader, PageLoader) — eski API saqlangan,
 * ko'rinish v2 primitivlarida (`src/shared/ui/primitives`).
 */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("EmptyState (v1 o'rami)", () => {
  it("emoji o'rniga lucide ikonka; o'z kartasida (v1 dagi kabi)", () => {
    const { container } = render(<EmptyState icon="📦" title="Paket yo'q" description="Hali paket yaratilmagan." />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-state-size", "card");
    expect(root).toHaveClass("rounded-[14px]", "border", "bg-surface");
    expect(root.querySelector("svg.lucide-package")).not.toBeNull();
    expect(root).not.toHaveTextContent("📦");
    expect(screen.getByText("Paket yo'q")).toHaveClass("font-bold");
  });

  it("sukut (📭) — Inbox; element ikonka saqlanadi", () => {
    const { container, rerender } = render(<EmptyState title="Bo'sh" />);
    expect(container.querySelector("svg.lucide-inbox")).not.toBeNull();
    rerender(<EmptyState title="Bo'sh" icon={<Scale size={28} />} />);
    expect(container.querySelector("svg.lucide-scale")).not.toBeNull();
  });

  it("`border-0 bg-transparent shadow-none` — ramkasiz variant (karta/jadval ichida), boshqa klass o'tadi", () => {
    const { container } = render(<EmptyState title="Bo'sh" className="border-0 bg-transparent shadow-none mt-4" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).not.toHaveClass("border", "bg-surface", "border-0", "bg-transparent");
    expect(root).toHaveClass("mt-4");
  });
});

describe("QueryErrorState (v1 o'rami)", () => {
  it("xato holati: sarlavha, izoh, «Qayta urinish» (secondary) → onRetry", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(<QueryErrorState description="Bildirishnomalarni yuklab bo'lmadi." onRetry={retry} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Ma'lumotni yuklab bo'lmadi");
    expect(alert).toHaveTextContent("Bildirishnomalarni yuklab bo'lmadi.");
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("izohsiz va `onRetry` siz — sukut matn, tugma yo'q; jadval ichida ramkasiz", () => {
    const { container } = render(<QueryErrorState className="border-0 bg-transparent shadow-none" />);
    expect(screen.getByText("Birozdan keyin qayta urinib ko'ring.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.firstElementChild).not.toHaveClass("border");
  });
});

describe("TableSkeleton (v1 o'rami)", () => {
  it("v2 jadval skeleti: 400 ms gacha ko'rinmaydi, aria-busy + «Yuklanmoqda…»", () => {
    vi.useFakeTimers();
    const { container } = render(<TableSkeleton rows={8} columns={7} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("aria-busy", "true");
    expect(root).toHaveTextContent("Yuklanmoqda…");
    const table = root.querySelector("[data-skeleton-preset='table']");
    expect(table).toHaveClass("invisible");
    act(() => vi.advanceTimersByTime(SKELETON_DELAY_MS));
    expect(table).not.toHaveClass("invisible");
    expect(table?.querySelectorAll(".h-14")).toHaveLength(8);
  });
});

describe("Loader va PageLoader (v1 o'rami)", () => {
  it("Loader — 32 px halqa, role=status «Yuklanmoqda…»", () => {
    render(<Loader className="mx-auto" />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Yuklanmoqda…");
    expect(status).toHaveClass("mx-auto", "text-action-fg");
    expect(status.querySelector("[data-spinner]")).toHaveClass("size-8");
  });

  it("PageLoader — navy fon, logotip, «Yuklanmoqda…», harakat kamaytiriladi", () => {
    render(<PageLoader />);
    const status = screen.getByRole("status", { name: "Ilova yuklanmoqda" });
    expect(status).toHaveClass("fixed", "inset-0", "bg-nav");
    expect(screen.getByRole("img", { name: "Elchi Pochta" })).toBeInTheDocument();
    expect(status).toHaveTextContent("Yuklanmoqda…");
    expect(status.querySelector(".motion-reduce\\:animate-none")).not.toBeNull();
    expect(status.className).not.toMatch(/gradient|bg-linear|text-white|font-black/);
  });
});
