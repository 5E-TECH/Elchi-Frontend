import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { Route, Routes, useLocation, useNavigate, type NavigateFunction } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import RegionLogistAssignmentPage from "./index";

/**
 * «Logist biriktirish» (LG-2; maketlar `*-regions-logist-assignment`, `-confirm-dialog`, `-empty`) — haqiqiy UI
 * orqali: logistlar ro'yxati va belgilari, 6 karta holati, filtr, faqat qo'shish — darhol saqlash, olib tashlash /
 * o'tkazish — tasdiq oynasi, boshqa logistga o'tishda saqlanmagan o'zgarish tasdig'i, nofaol logist, `?logist=`,
 * bo'sh va xato holatlari. `notify` / `confirm` mock qilinmaydi.
 */

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("../../../../shared/api/api", () => ({ api }));

const LOGISTS = [
  { id: "4", name: "Malika Yusupova", phone_number: "+998944567890", status: "inactive" },
  { id: "1", name: "Aziz Rahimov", phone_number: "+998901234567", status: "active" },
  { id: "3", name: "Sherzod Nazarov", phone_number: "+998933456789", status: "active" },
  { id: "2", name: "Dilnoza Karimova", phone_number: "+998912345678", status: "active" },
];

const REGIONS = [
  { id: "1", name: "Toshkent shahri", logist_id: null },
  { id: "2", name: "Toshkent viloyati", logist_id: 2 },
  { id: "3", name: "Andijon viloyati", logist_id: null },
  { id: "4", name: "Buxoro viloyati", logist_id: null },
  { id: "5", name: "Farg'ona viloyati", logist_id: null },
  { id: "6", name: "Jizzax viloyati", logist_id: "2" },
  { id: "7", name: "Namangan viloyati", logist_id: null },
  { id: "8", name: "Navoiy viloyati", logist_id: "1" },
  { id: "9", name: "Qashqadaryo viloyati", logist_id: "1" },
  { id: "10", name: "Qoraqalpog'iston Respublikasi", logist_id: null },
  { id: "11", name: "Samarqand viloyati", logist_id: "1" },
  { id: "12", name: "Sirdaryo viloyati", logist_id: "2" },
  { id: "13", name: "Surxondaryo viloyati", logist_id: "1" },
  { id: "14", name: "Xorazm viloyati", logist_id: null },
];

let logists: unknown[] = LOGISTS;
let logistsFail = false;
let regions: unknown[] = REGIONS;
let regionsFail = false;

beforeEach(() => {
  logists = LOGISTS;
  logistsFail = false;
  regions = REGIONS;
  regionsFail = false;
  api.get.mockReset().mockImplementation((url: string) => {
    if (url === "logists") {
      if (logistsFail) {
        return Promise.reject(Object.assign(new Error("Network Error"), { isAxiosError: true }));
      }
      return Promise.resolve({
        data: { statusCode: 200, data: { items: logists, meta: { total: logists.length } } },
      });
    }
    if (url === "region") {
      if (regionsFail) {
        return Promise.reject(Object.assign(new Error("Network Error"), { isAxiosError: true }));
      }
      return Promise.resolve({ data: { statusCode: 200, data: regions } });
    }
    return Promise.resolve({ data: {} });
  });
  api.post.mockReset().mockResolvedValue({ data: { statusCode: 200, data: {} } });
});

/** Testdan URL almashtirish (masalan «Logist yaratish» dan qaytish) — `MemoryRouter` ichidagi `navigate`. */
const navigateRef: { current: NavigateFunction | null } = { current: null };

const Where = () => {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);
  return <span data-testid="path">{`${location.pathname}${location.search}`}</span>;
};

const open = (role = "superadmin", route = "/regions/logist-assignment") =>
  renderWithProviders(
    <Routes>
      <Route
        path="/regions/logist-assignment"
        element={
          <>
            <RegionLogistAssignmentPage />
            <Where />
          </>
        }
      />
      <Route path="/regions" element={<Where />} />
    </Routes>,
    { route, preloadedState: { role: { id: "1", role, region: null, name: role } } as never },
  );

const regionsCard = () => screen.getByRole("region", { name: /viloyatlari$/ });
const checkbox = (name: RegExp) => within(regionsCard()).getByRole("checkbox", { name });
const footer = () => within(regionsCard()).getAllByRole("status").at(-1) as HTMLElement;
const saveButton = () => within(regionsCard()).getByRole("button", { name: "Saqlash" });
const logistButton = (name: RegExp) =>
  within(screen.getByRole("group", { name: "Logistlar ro'yxati" })).getByRole("button", { name });

describe("RegionLogistAssignmentPage — ro'yxat va holatlar", () => {
  it.each(["superadmin", "admin"])(
    "%s: logistlar, belgilar, birinchi faol logist tanlangan, viloyatlar",
    async (role) => {
      open(role);

      expect(
        await screen.findByRole("heading", { level: 2, name: "Aziz Rahimov viloyatlari" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 1, name: "Logist biriktirish" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Logistni tanlang va unga viloyatlarni belgilang · bir viloyatda bitta logist",
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Logist yaratish" })).toHaveAttribute(
        "href",
        "/all-users/create-user?role=logist",
      );

      const list = screen.getByRole("group", { name: "Logistlar ro'yxati" });
      const rows = within(list).getAllByRole("button");
      expect(rows.map((row) => row.textContent)).toEqual([
        "ARAziz Rahimov+998 90 123 45 674 viloyat",
        "DKDilnoza Karimova+998 91 234 56 783 viloyat",
        "SNSherzod Nazarov+998 93 345 67 89Viloyatsiz",
        "MYMalika Yusupova+998 94 456 78 90Nofaol",
      ]);
      expect(rows[0]).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText("Nofaol logistga viloyat biriktirilmaydi.")).toBeInTheDocument();

      expect(
        screen.getByText("+998 90 123 45 67 · 14 tadan 4 tasi belgilangan"),
      ).toBeInTheDocument();
      const filter = screen.getByRole("radiogroup", { name: "Viloyatlar filtri" });
      expect(
        within(filter)
          .getAllByRole("radio")
          .map((option) => option.textContent),
      ).toEqual(["Barchasi · 14", "Belgilangan · 4", "Logistsiz · 7"]);
      // Telefonda segment eni matnga qarab — ikki xonali son bilan ham «…» bo'lmaydi.
      expect(filter).toHaveClass("max-md:[&>button]:flex-auto");

      const cards = within(regionsCard()).getAllByRole("checkbox");
      expect(cards).toHaveLength(14);
      expect(cards[0]).toHaveAccessibleName("Toshkent sh. Logist yo'q");
      expect(cards[1]).toHaveAccessibleName("Toshkent vil. Dilnoza Karimova");
      expect(checkbox(/^Navoiy/)).toBeChecked();
      expect(checkbox(/^Navoiy/)).toHaveAccessibleName("Navoiy Biriktirilgan");
      expect(within(footer()).getByText("O'zgarish yo'q")).toBeInTheDocument();
      expect(saveButton()).toBeDisabled();
      // Birinchi tanlangan logist URL'ga yoziladi — keyin ro'yxat tartibi o'zgarsa ham tanlov ko'chmaydi.
      await waitFor(() =>
        expect(screen.getByTestId("path")).toHaveTextContent("/regions/logist-assignment?logist=1"),
      );
    },
  );

  it("asosiy matn 14 px (`text-sm`, maket `.el-strong`): viloyat, logist ismi, «N ta o'zgarish»", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole("heading", { name: "Aziz Rahimov viloyatlari" });

    expect(within(regionsCard()).getByText("Toshkent sh.")).toHaveClass("text-sm", "font-semibold");
    expect(within(logistButton(/^Aziz/)).getByText("Aziz Rahimov")).toHaveClass("text-sm");

    await user.click(checkbox(/^Buxoro/));
    await user.click(checkbox(/^Surxondaryo/));
    expect(within(footer()).getByText("2 ta o'zgarish")).toHaveClass("text-sm");
    const sticky = screen.getByRole("region", { name: "Saqlanmagan o'zgarishlar" });
    expect(within(sticky).getByText("2 ta o'zgarish")).toHaveClass("text-sm");

    await user.click(saveButton());
    const dialog = await screen.findByRole("alertdialog", { name: "O'zgarishlarni saqlaysizmi?" });
    expect(within(dialog).getByText("Surxondaryo")).toHaveClass("text-sm");
  });

  it("filtr «Logistsiz» va «Belgilangan», qidiruv ism/telefon bo'yicha", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole("heading", { name: "Aziz Rahimov viloyatlari" });

    await user.click(screen.getByRole("radio", { name: "Logistsiz · 7" }));
    expect(within(regionsCard()).getAllByRole("checkbox")).toHaveLength(7);
    await user.click(screen.getByRole("radio", { name: "Belgilangan · 4" }));
    expect(
      within(regionsCard())
        .getAllByRole("checkbox")
        .map((item) => item.closest("label")?.textContent),
    ).toEqual([
      "NavoiyBiriktirilgan",
      "QashqadaryoBiriktirilgan",
      "SamarqandBiriktirilgan",
      "SurxondaryoBiriktirilgan",
    ]);

    const search = screen.getByRole("searchbox", { name: "Logistni qidirish" });
    await user.type(search, "93 345");
    expect(
      within(screen.getByRole("group", { name: "Logistlar ro'yxati" })).getAllByRole("button"),
    ).toHaveLength(1);
    await user.clear(search);
    await user.type(search, "Zarina");
    expect(screen.getByText("Logist topilmadi")).toBeInTheDocument();
  });

  it("?logist=<id> — shu logist tanlangan holda ochiladi", async () => {
    open("admin", "/regions/logist-assignment?logist=3");
    expect(
      await screen.findByRole("heading", { name: "Sherzod Nazarov viloyatlari" }),
    ).toBeInTheDocument();
    expect(logistButton(/^Sherzod/)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("+998 93 345 67 89 · 14 tadan 0 tasi belgilangan")).toBeInTheDocument();
  });

  it("?logist=<yangi id> ro'yxat yangilanayotganda — URL birinchi logistga almashtirilmaydi, yangi logist tanlanadi", async () => {
    const view = open("admin");
    expect(await screen.findByRole("heading", { name: /viloyatlari$/ })).toBeInTheDocument();
    // «Logist yaratish» dan qaytish: kesh eski (yangi logist yo'q), qayta so'rov sekin keladi.
    let release: () => void = () => undefined;
    logists = [...LOGISTS, { id: "57", name: "Lola Karimova", phone_number: "+998901112233", status: "active" }];
    const original = api.get.getMockImplementation();
    api.get.mockImplementation((url: string) =>
      url === "logists"
        ? new Promise((resolve) => {
            release = () => resolve(original?.(url));
          })
        : original?.(url),
    );
    await act(async () => {
      void view.queryClient.invalidateQueries({ queryKey: ["logists"] });
    });
    await act(async () => {
      navigateRef.current?.("/regions/logist-assignment?logist=57");
    });
    expect(screen.getByTestId("path")).toHaveTextContent("?logist=57");
    await act(async () => release());
    expect(await screen.findByRole("heading", { name: "Lola Karimova viloyatlari" })).toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent("?logist=57");
  });

  it("logist yo'q — «Logist yo'q» + «Logist yaratish»", async () => {
    logists = [];
    open();
    expect(await screen.findByText("Logist yo'q")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Viloyatlarni biriktirish uchun avval «Logist» rolida foydalanuvchi yarating. Yaratilgan logist shu ro'yxatda chiqadi.",
      ),
    ).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Logist yaratish" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/all-users/create-user?role=logist");
    expect(screen.queryByText("Bo'lim hali ishga tushmagan")).not.toBeInTheDocument();
  });

  it("yuklashda xato — i18n matn va «Qayta urinish»", async () => {
    logistsFail = true;
    const user = userEvent.setup();
    open();
    expect(await screen.findByText("Logistlarni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText("Internet aloqasini tekshirib, qayta urining.")).toBeInTheDocument();
    expect(screen.queryByText("Network Error")).not.toBeInTheDocument();

    logistsFail = false;
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(
      await screen.findByRole("heading", { name: "Aziz Rahimov viloyatlari" }),
    ).toBeInTheDocument();
  });

  it("boshqa rol — /regions ga qaytariladi, so'rov ketmaydi", () => {
    open("courier");
    expect(screen.getByTestId("path")).toHaveTextContent("/regions");
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe("RegionLogistAssignmentPage — saqlash", () => {
  it("6 holat; olib tashlash/o'tkazish bo'lsa tasdiq oynasi → POST region/logist/bulk → «Saqlandi»", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole("heading", { name: "Aziz Rahimov viloyatlari" });

    await user.click(checkbox(/^Buxoro/));
    await user.click(checkbox(/^Jizzax/));
    await user.click(checkbox(/^Surxondaryo/));

    expect(checkbox(/^Buxoro/)).toHaveAccessibleName("Buxoro Hozir logist yo'q Qo'shiladi");
    expect(checkbox(/^Jizzax/)).toHaveAccessibleName("Jizzax Hozir: Dilnoza Karimova O'tkaziladi");
    expect(checkbox(/^Surxondaryo/)).toHaveAccessibleName(
      "Surxondaryo Logistsiz qoladi Olib tashlanadi",
    );
    expect(screen.getByText("+998 90 123 45 67 · 14 tadan 5 tasi belgilangan")).toBeInTheDocument();
    expect(within(footer()).getByText("3 ta o'zgarish")).toBeInTheDocument();
    expect(
      within(footer()).getByText("1 ta qo'shiladi · 1 ta o'tkaziladi · 1 ta olib tashlanadi"),
    ).toBeInTheDocument();
    // Telefondagi yopishqoq panel ham chiziladi (CSS bilan faqat telefonda ko'rinadi).
    const sticky = screen.getByRole("region", { name: "Saqlanmagan o'zgarishlar" });
    expect(
      within(sticky).getByText("1 qo'shiladi · 1 o'tkaziladi · 1 olib tashlanadi"),
    ).toBeInTheDocument();

    // Oynada «Bekor qilish» — so'rov ketmaydi.
    await user.click(saveButton());
    let dialog = await screen.findByRole("alertdialog", { name: "O'zgarishlarni saqlaysizmi?" });
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(api.post).not.toHaveBeenCalled();

    await user.click(saveButton());
    dialog = await screen.findByRole("alertdialog", { name: "O'zgarishlarni saqlaysizmi?" });
    expect(
      within(dialog).getByText(
        "Aziz Rahimov viloyatlari yangilanadi: 1 ta viloyat olib tashlanadi, 1 tasi boshqa logistdan o'tadi.",
      ),
    ).toBeInTheDocument();
    const items = within(within(dialog).getByRole("list", { name: "O'zgarishlar" })).getAllByRole(
      "listitem",
    );
    expect(items.map((item) => item.textContent)).toEqual([
      "SurxondaryoViloyat logistsiz qoladiOlib tashlanadi",
      "JizzaxDilnoza Karimovadan olinadiO'tkaziladi",
      "BuxoroHozir logist yo'qQo'shiladi",
    ]);
    expect(
      within(dialog).getByText(
        "Logistsiz viloyat hech bir logistning bosh sahifasida ko'rinmaydi.",
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith("region/logist/bulk", {
      logist_id: "1",
      region_ids: ["4", "6", "8", "9", "11"],
    });
    expect(await screen.findByText("Saqlandi")).toBeInTheDocument();
    expect(screen.getByText("Aziz Rahimov · 5 ta viloyat")).toBeInTheDocument();
  });

  it("faqat qo'shish — tasdiqsiz darhol saqlanadi; «Bekor qilish» qoralamani tashlaydi", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole("heading", { name: "Aziz Rahimov viloyatlari" });

    await user.click(checkbox(/^Xorazm/));
    await user.click(within(regionsCard()).getByRole("button", { name: "Bekor qilish" }));
    expect(checkbox(/^Xorazm/)).not.toBeChecked();
    expect(within(footer()).getByText("O'zgarish yo'q")).toBeInTheDocument();

    await user.click(checkbox(/^Xorazm/));
    await user.click(saveButton());
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("region/logist/bulk", {
      logist_id: "1",
      region_ids: ["8", "9", "11", "13", "14"],
    });
    expect(await screen.findByText("Aziz Rahimov · 5 ta viloyat")).toBeInTheDocument();
  });

  it("server rad etsa (400) — i18n xabar, server matni yo'q, o'zgarishlar sahifada qoladi", async () => {
    api.post.mockRejectedValue(
      Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        response: {
          status: 400,
          data: { message: "Logist faol emas (bloklangan) — viloyatga biriktirib bo'lmaydi" },
        },
      }),
    );
    const user = userEvent.setup();
    open();
    await screen.findByRole("heading", { name: "Aziz Rahimov viloyatlari" });

    await user.click(checkbox(/^Xorazm/));
    await user.click(saveButton());

    expect(await screen.findByText("Saqlab bo'lmadi")).toBeInTheDocument();
    expect(
      screen.getByText("Logist nofaol — avval uni faollashtiring. O'zgarishlar sahifada qoldi."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/bloklangan/)).not.toBeInTheDocument();
    expect(checkbox(/^Xorazm/)).toBeChecked();
    expect(within(footer()).getByText("1 ta o'zgarish")).toBeInTheDocument();
  });

  it("400 va logist shu orada nofaol bo'lgan — tanlov o'sha logistda qoladi, qoralama ko'rinadi", async () => {
    api.post.mockImplementation(() => {
      // Boshqa admin Azizni o'chirgan: qayta so'rovda u nofaol va saralashda oxirga tushadi.
      logists = LOGISTS.map((item) => (item.id === "1" ? { ...item, status: "inactive" } : item));
      return Promise.reject(
        Object.assign(new Error("Request failed"), {
          isAxiosError: true,
          response: { status: 400, data: { message: "Logist faol emas" } },
        }),
      );
    });
    const user = userEvent.setup();
    open();
    await screen.findByRole("heading", { name: "Aziz Rahimov viloyatlari" });

    await user.click(checkbox(/^Xorazm/));
    await user.click(saveButton());

    expect(await screen.findByText("Saqlab bo'lmadi")).toBeInTheDocument();
    expect(await screen.findByText("Aziz Rahimov nofaol")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Aziz Rahimov viloyatlari" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dilnoza Karimova viloyatlari" })).toBeNull();
    expect(checkbox(/^Xorazm/)).toBeChecked();
    expect(saveButton()).toBeDisabled();
  });

  it("saqlangandan keyin qayta so'rov xato bersa — saqlangan holat ko'rinadi, xato ekrani yo'q", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole("heading", { name: "Aziz Rahimov viloyatlari" });

    regionsFail = true;
    await user.click(checkbox(/^Xorazm/));
    await user.click(saveButton());

    expect(await screen.findByText("Saqlandi")).toBeInTheDocument();
    await waitFor(() =>
      expect(within(footer()).getByText("O'zgarish yo'q")).toBeInTheDocument(),
    );
    expect(checkbox(/^Xorazm/)).toBeChecked();
    expect(checkbox(/^Xorazm/)).toHaveAccessibleName("Xorazm Biriktirilgan");
    expect(screen.queryByText("Viloyatlarni yuklab bo'lmadi")).not.toBeInTheDocument();
  });

  it("saqlanmagan o'zgarish bilan boshqa logist — «Qolish» / «O'zgarishsiz o'tish»", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole("heading", { name: "Aziz Rahimov viloyatlari" });

    await user.click(checkbox(/^Buxoro/));
    await user.click(checkbox(/^Surxondaryo/));
    await user.click(logistButton(/^Dilnoza/));

    let dialog = await screen.findByRole("alertdialog", { name: "O'zgarishlar saqlanmaydi" });
    expect(
      within(dialog).getByText(
        "Aziz Rahimov uchun 2 ta o'zgarish saqlanmagan. Dilnoza Karimovaga o'tsangiz, ular bekor bo'ladi.",
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Qolish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Aziz Rahimov viloyatlari" })).toBeInTheDocument();
    expect(checkbox(/^Buxoro/)).toBeChecked();

    await user.click(logistButton(/^Dilnoza/));
    dialog = await screen.findByRole("alertdialog", { name: "O'zgarishlar saqlanmaydi" });
    await user.click(within(dialog).getByRole("button", { name: "O'zgarishsiz o'tish" }));
    expect(
      await screen.findByRole("heading", { name: "Dilnoza Karimova viloyatlari" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent("/regions/logist-assignment?logist=2");
    expect(checkbox(/^Jizzax/)).toHaveAccessibleName("Jizzax Biriktirilgan");
    expect(checkbox(/^Buxoro/)).not.toBeChecked();

    // Qaytib kelganda Aziz qoralamasi yo'q.
    await user.click(logistButton(/^Aziz/));
    expect(
      await screen.findByRole("heading", { name: "Aziz Rahimov viloyatlari" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(checkbox(/^Buxoro/)).not.toBeChecked();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("nofaol logist — ogohlantirish, kartalar va «Saqlash» o'chiq", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole("heading", { name: "Aziz Rahimov viloyatlari" });

    await user.click(logistButton(/^Malika/));
    expect(await screen.findByText("Malika Yusupova nofaol")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Nofaol logistga viloyat biriktirib bo'lmaydi. Uni «Foydalanuvchilar» bo'limida faollashtiring.",
      ),
    ).toBeInTheDocument();
    for (const box of within(regionsCard()).getAllByRole("checkbox")) expect(box).toBeDisabled();
    expect(saveButton()).toBeDisabled();
  });
});
