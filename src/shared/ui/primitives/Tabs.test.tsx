import { createRef, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Globe } from "lucide-react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { getPanelId, getTabId, Tabs, type TabItem, type TabsProps } from "./Tabs";

/**
 * Tabs: WAI-ARIA tablist (roving tabindex, ← → Home End, avtomatik faollashtirish),
 * son formati, panel id sxemasi, havola rejimi (`nav` + `aria-current`), sig'maganda
 * chetdagi xiralashish va tanlangan tabni ko'rinishga surish.
 */

type Status = "all" | "new" | "received" | "onTheRoad" | "waiting";

const ITEMS: TabItem<Status>[] = [
  { value: "all", label: "Barchasi", count: 1248 },
  { value: "new", label: "Yangi", count: 32 },
  { value: "received", label: "Qabul qilindi", count: 120, disabled: true },
  { value: "onTheRoad", label: "Yo'lda", count: 86, title: "Yo'ldagi buyurtmalar" },
  { value: "waiting", label: "Kutilmoqda", count: 0 },
];

const Controlled = ({
  initial = "all",
  onChange,
  ...props
}: Partial<TabsProps<Status>> & { initial?: Status; onChange?: (value: Status) => void }) => {
  const [value, setValue] = useState<Status>(initial);
  return (
    <Tabs
      idPrefix="t"
      ariaLabel="Holat bo'yicha"
      items={ITEMS}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      {...props}
    />
  );
};

const tab = (name: RegExp) => screen.getByRole("tab", { name });

/** jsdom'da maket yo'q — ro'yxat o'lchamlarini qo'lda beramiz. */
const fakeLayout = (list: HTMLElement, { scrollWidth, clientWidth }: { scrollWidth: number; clientWidth: number }) => {
  let scrollLeft = 0;
  Object.defineProperty(list, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(list, "clientWidth", { configurable: true, value: clientWidth });
  Object.defineProperty(list, "scrollLeft", {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value;
    },
  });
  const scrollTo = vi.fn();
  Object.defineProperty(list, "scrollTo", { configurable: true, value: scrollTo });
  return {
    scrollTo,
    setScrollLeft: (value: number) => {
      scrollLeft = value;
      fireEvent.scroll(list);
    },
  };
};

afterEach(async () => {
  if (i18n.language !== "uz") await i18n.changeLanguage("uz");
});

describe("Tabs — tablist semantikasi", () => {
  it("tablist nomi bilan, har tab role=tab, faqat tanlangani aria-selected", () => {
    render(<Controlled initial="new" />);
    expect(screen.getByRole("tablist", { name: "Holat bo'yicha" })).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    expect(tabs.map((el) => el.getAttribute("aria-selected"))).toEqual(["false", "true", "false", "false", "false"]);
    expect(tab(/^Yangi/)).toHaveAttribute("id", getTabId("t", "new"));
  });

  it("roving tabindex: faqat tanlangan tab Tab tartibida", () => {
    render(<Controlled initial="onTheRoad" />);
    expect(screen.getAllByRole("tab").map((el) => el.tabIndex)).toEqual([-1, -1, -1, 0, -1]);
  });

  it("tanlangan qiymat o'chirilgan yoki yo'q bo'lsa — birinchi faol tab fokuslanadi", () => {
    render(<Controlled initial="received" />);
    expect(screen.getAllByRole("tab").map((el) => el.tabIndex)).toEqual([0, -1, -1, -1, -1]);
  });

  it("o'chirilgan tab: disabled, bosilsa tanlanmaydi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    expect(tab(/^Qabul qilindi/)).toBeDisabled();
    await user.click(tab(/^Qabul qilindi/));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(tab(/^Yo'lda/));
    expect(onChange).toHaveBeenCalledWith("onTheRoad");
    expect(tab(/^Yo'lda/)).toHaveAttribute("aria-selected", "true");
  });

  it("tanlangan tabni qayta bosish onValueChange chaqirmaydi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await user.click(tab(/^Barchasi/));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("title (maslahat) tabga o'tadi, ikonka aria-hidden", () => {
    render(
      <Tabs
        ariaLabel="Ulanish turlari"
        items={[{ value: "external", label: "Tashqi tizimlar", icon: Globe }]}
        value="external"
        onValueChange={() => undefined}
      />,
    );
    expect(screen.getByRole("tab", { name: "Tashqi tizimlar" }).querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    render(<Controlled />);
    expect(tab(/^Yo'lda/)).toHaveAttribute("title", "Yo'ldagi buyurtmalar");
  });
});

describe("Tabs — klaviatura (avtomatik faollashtirish)", () => {
  it("← → Home End fokusni suradi va darhol tanlaydi, o'chirilganini o'tkazadi, aylanma", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);

    await user.tab();
    expect(tab(/^Barchasi/)).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(tab(/^Yangi/)).toHaveFocus();
    expect(tab(/^Yangi/)).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowRight}"); // «Qabul qilindi» o'chirilgan — o'tkaziladi
    expect(tab(/^Yo'lda/)).toHaveFocus();

    await user.keyboard("{End}");
    expect(tab(/^Kutilmoqda/)).toHaveFocus();

    await user.keyboard("{ArrowRight}"); // oxiridan boshiga
    expect(tab(/^Barchasi/)).toHaveFocus();

    await user.keyboard("{ArrowLeft}"); // boshidan oxiriga
    expect(tab(/^Kutilmoqda/)).toHaveFocus();

    await user.keyboard("{Home}");
    expect(tab(/^Barchasi/)).toHaveFocus();
    expect(tab(/^Barchasi/)).toHaveAttribute("aria-selected", "true");

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([
      "new",
      "onTheRoad",
      "waiting",
      "all",
      "waiting",
      "all",
    ]);
  });

  it("hamma tab o'chirilgan bo'lsa — Tab to'xtash joyi yo'q, strelka xato bermaydi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <Tabs
          ariaLabel="Bo'sh"
          items={ITEMS.map((item) => ({ ...item, disabled: true }))}
          value="all"
          onValueChange={onChange}
        />
        <button type="button">Keyingi maydon</button>
      </>,
    );
    expect(screen.getAllByRole("tab").every((el) => el.tabIndex === -1)).toBe(true);
    await user.tab();
    expect(screen.getByRole("button", { name: "Keyingi maydon" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("boshqa tugmalar (harf, ↑ ↓) tanlovni ham, fokusni ham o'zgartirmaydi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await user.tab();
    await user.keyboard("a{ArrowDown}{ArrowUp}");
    expect(onChange).not.toHaveBeenCalled();
    expect(tab(/^Barchasi/)).toHaveFocus();
  });

  it("Tab tugmasi tablistdan bitta qadamda chiqadi", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Controlled initial="new" />
        <button type="button">Keyingi maydon</button>
      </>,
    );
    await user.tab();
    expect(tab(/^Yangi/)).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Keyingi maydon" })).toHaveFocus();
  });
});

describe("Tabs — son", () => {
  it("formatNumberLocalized bilan; nol ham ko'rsatiladi; nomga bo'shliq bilan qo'shiladi", () => {
    render(<Controlled />);
    expect(screen.getByText("1 248")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Kutilmoqda 0" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Barchasi 1 248" })).toBeInTheDocument();
  });

  it("til almashsa son formati ham almashadi (en: 1,248)", async () => {
    render(<Controlled />);
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    expect(screen.getByText("1,248")).toBeInTheDocument();
  });

  it("tanlangan tab soni ko'k (action-soft), qolgani neytral (sunken)", () => {
    render(<Controlled />);
    expect(screen.getByText("1 248")).toHaveClass("bg-action-soft", "text-action-fg");
    expect(screen.getByText("32")).toHaveClass("bg-sunken", "text-text-muted");
  });

  it("sahifa fonida (`background=\"bg\"`) nofaol son — yuza + chegara (maket `courier-mails-today`), faoli o'zgarmaydi", () => {
    render(<Controlled background="bg" />);
    expect(screen.getByText("1 248")).toHaveClass("bg-action-soft", "text-action-fg");
    expect(screen.getByText("32")).toHaveClass("bg-surface", "border", "border-border", "text-text-muted");
    expect(screen.getByText("32")).not.toHaveClass("bg-sunken");
  });
});

describe("Tabs — panel id sxemasi", () => {
  it("getTabId / getPanelId: barqaror, bo'shliqsiz", () => {
    expect(getTabId("orders", "all")).toBe("orders-tab-all");
    expect(getPanelId("orders", "all")).toBe("orders-panel-all");
    expect(getTabId("orders", "a b/c")).not.toMatch(/\s|\//);
    expect(getTabId("orders", "a b")).not.toBe(getTabId("orders", "a_b"));
  });

  it("controlsPanel: faqat tanlangan tab aria-controls oladi; panel tab nomi bilan", () => {
    const Page = () => {
      const [value, setValue] = useState<Status>("new");
      return (
        <>
          <Tabs idPrefix="p" ariaLabel="Holat" items={ITEMS} value={value} onValueChange={setValue} controlsPanel />
          <div role="tabpanel" id={getPanelId("p", value)} aria-labelledby={getTabId("p", value)}>
            panel
          </div>
        </>
      );
    };
    render(<Page />);
    expect(tab(/^Yangi/)).toHaveAttribute("aria-controls", getPanelId("p", "new"));
    expect(tab(/^Barchasi/)).not.toHaveAttribute("aria-controls");
    expect(screen.getByRole("tabpanel", { name: "Yangi 32" })).toBeInTheDocument();
  });

  it("controlsPanel siz aria-controls yo'q (mavjud bo'lmagan id ga ishora qilinmaydi)", () => {
    render(<Controlled />);
    expect(tab(/^Barchasi/)).not.toHaveAttribute("aria-controls");
  });

  it("idPrefix berilmasa — har nusxa o'z id sini oladi", () => {
    render(
      <>
        <Tabs ariaLabel="A" items={ITEMS} value="all" onValueChange={() => undefined} />
        <Tabs ariaLabel="B" items={ITEMS} value="all" onValueChange={() => undefined} />
      </>,
    );
    const ids = screen.getAllByRole("tab").map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Tabs — ko'rinish", () => {
  it("faol tab: action chizig'i + text-text; nofaol: text-text-muted", () => {
    render(<Controlled />);
    expect(tab(/^Barchasi/)).toHaveClass("border-action", "text-text");
    expect(tab(/^Yangi/)).toHaveClass("border-transparent", "text-text-muted", "hover:text-text");
  });

  it("telefonda tab 48 px (max-md:h-12), fokus halqasi tab ichida (aylanuvchi ro'yxatda kesilmaydi)", () => {
    render(<Controlled />);
    // `!` faqat outline-offset da (global halqa qatlamsiz); burchak oddiy utilita — global radius `@layer base` da.
    expect(tab(/^Barchasi/)).toHaveClass("h-11", "max-md:h-12", "-outline-offset-2!", "rounded-none");
    expect(tab(/^Barchasi/).className).not.toMatch(/rounded-\S*!/);
  });

  it("ostki chiziq o'ramda, ro'yxat -mb-px bilan uning ustida; tabning o'zida -mb-px yo'q (vertikal skroll bo'lmasin)", () => {
    render(<Controlled />);
    const list = screen.getByRole("tablist");
    expect(list).toHaveClass("-mb-px", "overflow-x-auto");
    expect(list).not.toHaveClass("border-b");
    expect(list.parentElement).toHaveClass("border-b", "border-border");
    for (const el of screen.getAllByRole("tab")) expect(el).not.toHaveClass("-mb-px");
  });

  it("ref, className va qo'shimcha atributlar tashqi o'ramga o'tadi (tab rejimi — div)", () => {
    const ref = createRef<HTMLElement>();
    render(<Controlled ref={ref} className="mt-4" data-testid="tabs" />);
    expect(ref.current).toBe(screen.getByTestId("tabs"));
    expect(ref.current?.tagName).toBe("DIV");
    expect(ref.current).toHaveClass("mt-4", "border-b");
    expect(ref.current).toContainElement(screen.getByRole("tablist"));
  });

  it("fullWidth: tablar teng bo'linadi va markazda", () => {
    render(<Controlled fullWidth />);
    for (const el of screen.getAllByRole("tab")) expect(el).toHaveClass("flex-auto", "justify-center");
  });

  it("ro'yxat gorizontal aylanadi, aylantirish chizig'i yashirin", () => {
    render(<Controlled listClassName="px-3" />);
    expect(screen.getByRole("tablist")).toHaveClass("overflow-x-auto", "scrollbar-hide", "px-3");
  });
});

describe("Tabs — sig'maganda", () => {
  it("o'ng/chap chetda xiralashish va o'q tugmasi aylantirish holatiga qarab chiqadi", () => {
    render(<Controlled />);
    const list = screen.getByRole("tablist");
    expect(screen.queryByRole("button", { name: "Keyingi tablar" })).not.toBeInTheDocument();

    const { setScrollLeft } = fakeLayout(list, { scrollWidth: 900, clientWidth: 300 });
    act(() => setScrollLeft(0));
    expect(screen.getByRole("button", { name: "Keyingi tablar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Oldingi tablar" })).not.toBeInTheDocument();

    act(() => setScrollLeft(300));
    expect(screen.getByRole("button", { name: "Keyingi tablar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oldingi tablar" })).toBeInTheDocument();

    act(() => setScrollLeft(600));
    expect(screen.queryByRole("button", { name: "Keyingi tablar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oldingi tablar" })).toHaveAttribute("tabindex", "-1");
  });

  it("o'q tugmasi ro'yxatni ~80% enga suradi", () => {
    render(<Controlled />);
    const list = screen.getByRole("tablist");
    const { scrollTo, setScrollLeft } = fakeLayout(list, { scrollWidth: 900, clientWidth: 300 });
    act(() => setScrollLeft(0));
    fireEvent.click(screen.getByRole("button", { name: "Keyingi tablar" }));
    expect(scrollTo).toHaveBeenCalledWith({ left: 240, behavior: "smooth" });
  });

  it("tanlangan tab ko'rinmasa — ro'yxat uni ko'rinishga suradi (xiralashish ostida qolmaydi)", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    const list = screen.getByRole("tablist");
    const { scrollTo } = fakeLayout(list, { scrollWidth: 900, clientWidth: 300 });
    const last = tab(/^Kutilmoqda/);
    Object.defineProperty(last, "offsetLeft", { configurable: true, value: 700 });
    Object.defineProperty(last, "offsetWidth", { configurable: true, value: 100 });

    await user.tab();
    await user.keyboard("{End}");
    // 800 (tab oxiri) − 300 (ko'rinadigan en) + 32 (telefondagi xiralashish)
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 532, behavior: "smooth" });
  });

  describe("tab sonlari keyin yuklanib, tablar kengaysa", () => {
    /** jsdom'da ResizeObserver yo'q — chaqiriqni qo'lda yuboramiz. */
    const installResizeObserver = () => {
      const callbacks: ResizeObserverCallback[] = [];
      class ManualResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          callbacks.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {
          const index = callbacks.length - 1;
          if (index >= 0) callbacks.splice(index, 1);
        }
      }
      globalThis.ResizeObserver = ManualResizeObserver as unknown as typeof ResizeObserver;
      return () => act(() => callbacks.forEach((callback) => callback([], {} as ResizeObserver)));
    };

    const mountWithLateCounts = () => {
      const fire = installResizeObserver();
      render(<Controlled initial="waiting" />);
      const list = screen.getByRole("tablist");
      const { scrollTo } = fakeLayout(list, { scrollWidth: 900, clientWidth: 300 });
      const active = tab(/^Kutilmoqda/);
      // Sonlar yuklangach tablar kengaydi — faol tab ko'rinadigan qismdan chiqdi.
      Object.defineProperty(active, "offsetLeft", { configurable: true, value: 700 });
      Object.defineProperty(active, "offsetWidth", { configurable: true, value: 100 });
      return { list, scrollTo, fire };
    };

    // setup.ts dagi umumiy mock boshqa testlar uchun qaytariladi.
    const sharedResizeObserver = globalThis.ResizeObserver;
    afterEach(() => {
      globalThis.ResizeObserver = sharedResizeObserver;
    });

    it("faol tab qayta ko'rinishga suriladi (darhol, silliq emas)", () => {
      const { scrollTo, fire } = mountWithLateCounts();
      fire();
      expect(scrollTo).toHaveBeenLastCalledWith({ left: 532, behavior: "auto" });
    });

    it("foydalanuvchi ro'yxatni o'zi sursa — o'lcham o'zgarishi uni qaytarib tortmaydi", () => {
      const { list, scrollTo, fire } = mountWithLateCounts();
      fireEvent.wheel(list);
      fire();
      expect(scrollTo).not.toHaveBeenCalled();
    });
  });
});

describe("Tabs — havola rejimi (route)", () => {
  const LINK_ITEMS: TabItem[] = [
    { value: "overview", label: "Umumiy ko'rinish", to: "/balance/overview" },
    { value: "history", label: "Tarix", to: "/balance/history", count: 12 },
    { value: "analysis", label: "Tahlil", to: "/balance/analysis" },
    { value: "export", label: "Eksport", to: "/balance/export", disabled: true },
  ];

  const renderAt = (path: string, props: Partial<TabsProps> = {}) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/balance/*"
            element={<Tabs ariaLabel="Balans bo'limlari" items={LINK_ITEMS} {...props} />}
          />
        </Routes>
      </MemoryRouter>,
    );

  it("nav + havolalar, tablist/tab ro'li yo'q; joriy route — aria-current=page", () => {
    renderAt("/balance/history");
    expect(screen.getByRole("navigation", { name: "Balans bo'limlari" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tarix 12" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Tahlil" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Tarix 12" })).toHaveClass("border-action", "text-text");
  });

  it("bosilganda route almashadi va aria-current ko'chadi", async () => {
    const user = userEvent.setup();
    renderAt("/balance/history");
    await user.click(screen.getByRole("link", { name: "Tahlil" }));
    expect(screen.getByRole("link", { name: "Tahlil" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Tarix 12" })).not.toHaveAttribute("aria-current");
  });

  it("o'chirilgan band — havola emas, aria-disabled", () => {
    renderAt("/balance/history");
    expect(screen.queryByRole("link", { name: "Eksport" })).not.toBeInTheDocument();
    expect(screen.getByText("Eksport")).toHaveAttribute("aria-disabled", "true");
  });

  it("value berilsa — faol tabni value belgilaydi, bosish onValueChange ni chaqiradi", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderAt("/balance/anything", { value: "analysis", onValueChange });
    expect(screen.getByRole("link", { name: "Tahlil" })).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("link", { name: "Umumiy ko'rinish" }));
    expect(onValueChange).toHaveBeenCalledWith("overview");
  });

  it("havolalar oddiy Tab tartibida (roving tabindex yo'q), o'chirilgan band o'tkaziladi", async () => {
    const user = userEvent.setup();
    renderAt("/balance/history");
    for (const link of screen.getAllByRole("link")) expect(link).not.toHaveAttribute("tabindex");
    await user.tab();
    expect(screen.getByRole("link", { name: "Umumiy ko'rinish" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Tarix 12" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Tahlil" })).toHaveFocus();
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it("strelkalar havola rejimida route'ni almashtirmaydi", async () => {
    const user = userEvent.setup();
    renderAt("/balance/history");
    await user.tab();
    await user.tab();
    await user.keyboard("{ArrowRight}{End}");
    expect(screen.getByRole("link", { name: "Tarix 12" })).toHaveFocus();
    expect(screen.getByRole("link", { name: "Tarix 12" })).toHaveAttribute("aria-current", "page");
  });

  it("ref nav elementiga tushadi", () => {
    const ref = createRef<HTMLElement>();
    renderAt("/balance/history", { ref });
    expect(ref.current).toBe(screen.getByRole("navigation", { name: "Balans bo'limlari" }));
  });
});
