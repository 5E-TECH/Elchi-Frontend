import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { Calendar } from "./Calendar";

/**
 * Calendar — `.el-cal-head` / `.el-cal-grid` / `.el-cal-dow` / `.el-cal-day` (CODE-MAP 2.2,
 * `tizim-states-forms` 04): oy to'ri, belgilar, WAI-ARIA grid klaviaturasi, min/max.
 */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

const TODAY = "2026-10-08";

/** Faol kun (roving tabIndex=0) — to'rga Tab bilan kiriladigan yagona kun. */
const activeDay = () => document.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]');

describe("Calendar — oy to'ri (tizim-states-forms 04)", () => {
  it("ikki oy yonma-yon: sarlavha, hafta kunlari dushanbadan, grid nomi — oy", () => {
    render(<Calendar mode="range" months={2} start="2026-10-01" end="2026-10-08" onSelect={() => {}} today={TODAY} />);

    const grids = screen.getAllByRole("grid");
    expect(grids).toHaveLength(2);
    expect(grids[0]).toHaveAccessibleName("Oktabr 2026");
    expect(grids[1]).toHaveAccessibleName("Noyabr 2026");
    // Ustun sarlavhalari: ko'rinishi qisqa («Du»), ekran o'quvchiga to'liq («Dushanba»).
    const headers = within(grids[0]).getAllByRole("columnheader");
    expect(headers.map((th) => th.textContent)).toEqual([
      "DuDushanba",
      "SeSeshanba",
      "ChChorshanba",
      "PaPayshanba",
      "JuJuma",
      "ShShanba",
      "YaYakshanba",
    ]);
    // Har oy 6 hafta.
    expect(within(grids[0]).getAllByRole("gridcell")).toHaveLength(42);
    expect(screen.getByRole("button", { name: "Oldingi oy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keyingi oy" })).toBeInTheDocument();
  });

  it("belgilar: boshlanish/tugash/oraliq — aria-selected, bugun — aria-current, nomi maketdagidek", () => {
    render(<Calendar mode="range" months={2} start="2026-10-01" end="2026-10-08" onSelect={() => {}} today={TODAY} />);
    const october = screen.getAllByRole("grid")[0];

    const first = within(october).getByRole("gridcell", { name: "1-oktabr, boshlanish" });
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(first).toHaveClass("bg-action", "text-on-solid");

    const eighth = within(october).getByRole("gridcell", { name: "8-oktabr, bugun, tugash" });
    expect(eighth).toHaveAttribute("aria-current", "date");
    expect(eighth).toHaveClass("bg-action");

    const fourth = within(october).getByRole("gridcell", { name: "4-oktabr" });
    expect(fourth).toHaveAttribute("aria-selected", "true");
    expect(fourth).toHaveClass("bg-action-soft", "rounded-none");

    const ninth = within(october).getByRole("gridcell", { name: "9-oktabr" });
    expect(ninth).toHaveAttribute("aria-selected", "false");

    // Qo'shni oy kuni (28-sentabr) — kulrang, ikki oyda belgilanmaydi.
    const muted = within(october).getByRole("gridcell", { name: "28-sentabr" });
    expect(muted).toHaveClass("text-text-subtle");
    expect(muted).toHaveAttribute("tabindex", "-1");
  });

  it("klaviatura: ← → ↑ ↓, Home/End, PageUp/PageDown; ko'rinmaydigan oyga o'tsa — oylar suriladi", async () => {
    const user = userEvent.setup();
    render(<Calendar mode="single" start="2026-10-08" onSelect={() => {}} today={TODAY} />);

    await user.tab(); // «Oldingi oy»
    await user.tab(); // «Keyingi oy» (sarlavha qatorida, to'rdan oldin)
    await user.tab(); // to'r — faol kun
    expect(document.activeElement).toBe(activeDay());
    expect(activeDay()).toHaveAttribute("data-day", "2026-10-08");

    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toHaveAttribute("data-day", "2026-10-09");
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toHaveAttribute("data-day", "2026-10-16");
    await user.keyboard("{ArrowUp}{ArrowLeft}");
    expect(document.activeElement).toHaveAttribute("data-day", "2026-10-08");
    await user.keyboard("{Home}");
    expect(document.activeElement).toHaveAttribute("data-day", "2026-10-05");
    await user.keyboard("{End}");
    expect(document.activeElement).toHaveAttribute("data-day", "2026-10-11");

    await user.keyboard("{PageDown}");
    expect(document.activeElement).toHaveAttribute("data-day", "2026-11-11");
    expect(screen.getByRole("grid")).toHaveAccessibleName("Noyabr 2026");

    await user.keyboard("{Shift>}{PageUp}{/Shift}");
    expect(document.activeElement).toHaveAttribute("data-day", "2025-11-11");
    expect(screen.getByRole("grid")).toHaveAccessibleName("Noyabr 2025");

    // Faqat bitta kun Tab'da (roving tabIndex).
    expect(document.querySelectorAll('[role="gridcell"][tabindex="0"]')).toHaveLength(1);
  });

  it("Enter va Bo'sh joy tanlaydi; min/max dan tashqari — aria-disabled, tanlanmaydi", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Calendar start="2026-10-08" onSelect={onSelect} min="2026-10-05" max="2026-10-20" today={TODAY} autoFocus />,
    );

    // autoFocus — ochilganda fokus tanlangan kunda.
    expect(document.activeElement).toHaveAttribute("data-day", "2026-10-08");
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith("2026-10-08");
    await user.keyboard("{ArrowRight} ");
    expect(onSelect).toHaveBeenLastCalledWith("2026-10-09");

    const early = screen.getByRole("gridcell", { name: "4-oktabr, tanlab bo'lmaydi" });
    expect(early).toHaveAttribute("aria-disabled", "true");
    await user.click(early);
    expect(onSelect).toHaveBeenCalledTimes(2);

    // Klaviatura chegaradan chiqmaydi.
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(document.activeElement).toHaveAttribute("data-day", "2026-10-05");
    // Chegara oyidan oldingi oy yo'q.
    expect(screen.getByRole("button", { name: "Oldingi oy" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keyingi oy" })).toBeDisabled();
  });

  it("«Oldingi/Keyingi oy» tugmalari oylarni almashtiradi; sichqoncha ustidagi kun — onPreview", async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    render(<Calendar mode="range" start="2026-10-01" onSelect={() => {}} onPreview={onPreview} today={TODAY} />);

    await user.click(screen.getByRole("button", { name: "Keyingi oy" }));
    expect(screen.getByRole("grid")).toHaveAccessibleName("Noyabr 2026");
    await user.click(screen.getByRole("button", { name: "Oldingi oy" }));
    await user.click(screen.getByRole("button", { name: "Oldingi oy" }));
    expect(screen.getByRole("grid")).toHaveAccessibleName("Sentabr 2026");

    await user.hover(screen.getByRole("gridcell", { name: "15-sentabr" }));
    expect(onPreview).toHaveBeenLastCalledWith("2026-09-15");
    await user.unhover(screen.getByRole("grid"));
    expect(onPreview).toHaveBeenLastCalledWith(null);
  });

  it("ikki oyda bugun bir marta belgilanadi: qo'shni oy nusxasida chiziq va aria-current yo'q", () => {
    render(<Calendar mode="range" months={2} defaultActive="2026-09-15" onSelect={() => {}} today={TODAY} />);
    const [september, october] = screen.getAllByRole("grid");
    expect(september).toHaveAccessibleName("Sentabr 2026");

    // Sentabr to'rining oxirgi qatorlarida 8-oktabr — qo'shni oy nusxasi.
    const copy = within(september).getByRole("gridcell", { name: "8-oktabr" });
    expect(copy).not.toHaveAttribute("aria-current");
    expect(copy).not.toHaveClass("ring-1");
    expect(within(october).getByRole("gridcell", { name: "8-oktabr, bugun" })).toHaveAttribute("aria-current", "date");
    expect(document.querySelectorAll('[aria-current="date"]')).toHaveLength(1);
  });

  it("«Keyingi oy» chegarada o'chsa — fokus body'ga tushmaydi, faol kunga o'tadi", async () => {
    const user = userEvent.setup();
    render(<Calendar start="2026-10-08" onSelect={() => {}} max="2026-11-20" today={TODAY} />);

    const next = screen.getByRole("button", { name: "Keyingi oy" });
    next.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("grid")).toHaveAccessibleName("Noyabr 2026");
    expect(next).toBeDisabled();
    expect(document.activeElement).toHaveAttribute("data-day", "2026-11-08");
  });

  it("tanlov tashqaridan o'zgarsa — faol kun va ko'rinadigan oy unga suriladi", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Calendar start="2026-10-08" onSelect={() => {}} today={TODAY} />);

    await user.click(screen.getByRole("button", { name: "Keyingi oy" }));
    await user.click(screen.getByRole("button", { name: "Keyingi oy" }));
    expect(screen.getByRole("grid")).toHaveAccessibleName("Dekabr 2026");

    rerender(<Calendar start="2026-09-30" onSelect={() => {}} today={TODAY} />);
    expect(screen.getByRole("grid")).toHaveAccessibleName("Sentabr 2026");
    expect(activeDay()).toHaveAttribute("data-day", "2026-09-30");
  });
});
