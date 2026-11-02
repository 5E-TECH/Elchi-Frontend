import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import RegionDistrictsPage from "./index";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
// Haqiqiy `MERGE_REQUEST_TIMEOUT_MS` qoladi — qiymati o'zgarsa so'rov tekshiruvi yiqiladi.
vi.mock("../../../../shared/api/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../shared/api/api")>()),
  api,
}));

const REGIONS = [
  {
    id: "1",
    name: "Toshkent shahri",
    sato_code: "1726",
    districts: [
      { id: "2", name: "Chilonzor" },
      { id: "3", name: "Mirobod" },
    ],
  },
  { id: "6", name: "Samarqand viloyati", sato_code: "1718", districts: [{ id: "179", name: "Samarqand shahri" }] },
];

const Where = () => <span data-testid="path">{useLocation().pathname}</span>;
const open = (role = "superadmin") =>
  renderWithProviders(
    <Routes>
      <Route path="/regions/districts" element={<RegionDistrictsPage />} />
      <Route path="/regions" element={<Where />} />
    </Routes>,
    {
      route: "/regions/districts",
      preloadedState: { role: { id: "1", role, region: null, name: role } } as never,
    },
  );

/** jsdom'da DataTransfer yo'q — oddiy xarita bilan. */
const dataTransfer = () => {
  const store: Record<string, string> = {};
  return {
    setData: (k: string, v: string) => {
      store[k] = v;
    },
    getData: (k: string) => store[k] ?? "",
  };
};
const drag = (districtId: string, toRegionId: string) => {
  const dt = dataTransfer();
  fireEvent.dragStart(screen.getByTestId(`district-${districtId}`), { dataTransfer: dt });
  fireEvent.dragOver(screen.getByTestId(`region-${toRegionId}`), { dataTransfer: dt });
  fireEvent.drop(screen.getByTestId(`region-${toRegionId}`), { dataTransfer: dt });
};

describe("RegionDistrictsPage (7exC7QKt)", () => {
  beforeEach(() => {
    api.get.mockResolvedValue({ data: { statusCode: 200, data: REGIONS } });
    api.post.mockResolvedValue({ data: { statusCode: 201 } });
    api.patch.mockResolvedValue({ data: { statusCode: 200 } });
    api.delete.mockResolvedValue({ data: { statusCode: 200 } });
  });
  afterEach(() => vi.clearAllMocks());

  it("lists every region with its districts (not a placeholder any more)", async () => {
    open();

    const tashkent = await screen.findByRole("region", { name: "Toshkent shahri" });
    expect(within(tashkent).getByText("Chilonzor")).toBeInTheDocument();
    expect(within(tashkent).getByText("Mirobod")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Samarqand viloyati" })).getByText(
        "Samarqand shahri",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("regions-count")).toHaveTextContent("2");
    expect(screen.getByTestId("districts-count")).toHaveTextContent("3");
  });

  it("adds a district with POST /district {name, region_id, sato_code} and refetches the list (ExK28CiS)", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText("Chilonzor");

    const form = screen.getByRole("region", { name: "Yangi tuman qo'shish" });
    const name = within(form).getByRole("textbox", { name: /Tuman nomi/ });
    const code = within(form).getByRole("textbox", { name: /SATO kodi/ });
    await user.type(name, "  Yangi tuman ");
    await user.click(within(form).getByRole("combobox", { name: /Viloyat/ }));
    await user.click(await screen.findByRole("option", { name: "Samarqand viloyati" }));
    await user.type(code, "1718240");
    await user.click(within(form).getByRole("button", { name: /Qo'shish/ }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("district", {
        name: "Yangi tuman",
        region_id: "6",
        sato_code: "1718240",
      }),
    );
    expect(await screen.findByText("Tuman qo'shildi")).toBeInTheDocument();
    expect(screen.getByText("Yangi tuman · Samarqand viloyati · 1718240")).toBeInTheDocument();
    // Forma tozalanadi (viloyat — keyingi tuman uchun qoladi), doska qayta yuklanadi.
    expect(name).toHaveValue("");
    expect(code).toHaveValue("");
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it("renames a district with PATCH /district/name/:id", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText("Mirobod");

    await user.click(screen.getByRole("button", { name: "Mirobod nomini tahrirlash" }));
    const input = within(screen.getByRole("region", { name: "Toshkent shahri" })).getByRole(
      "textbox",
      {
        name: "Tuman nomi",
      },
    );
    await user.clear(input);
    await user.type(input, "Mirobod tumani{Enter}");

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("district/name/3", { name: "Mirobod tumani" }),
    );
  });

  it("deletes a district only after the v2 confirmation (DELETE /district/:id)", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText("Mirobod");

    await user.click(screen.getByRole("button", { name: "Mirobodni o'chirish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Mirobod o'chirilsinmi?" });
    expect(api.delete).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("district/3"));
  });

  it("moves a dragged district to another region with PATCH /district/:id {assigned_region}", async () => {
    let resolvePatch: (value: unknown) => void = () => undefined;
    api.patch.mockReturnValue(
      new Promise((resolve) => {
        resolvePatch = resolve;
      }),
    );
    open();
    await screen.findByText("Chilonzor");

    act(() => drag("2", "6"));

    // Optimistik: server javobidan oldin yangi viloyatda turadi.
    await waitFor(() =>
      expect(
        within(screen.getByRole("region", { name: "Samarqand viloyati" })).getByText("Chilonzor"),
      ).toBeInTheDocument(),
    );
    expect(api.patch).toHaveBeenCalledWith("district/2", { assigned_region: "6" });
    await act(async () => resolvePatch({ data: { statusCode: 200 } }));
  });

  it("puts the district back where it was when the move fails", async () => {
    api.patch.mockRejectedValue(
      Object.assign(new Error("fail"), { isAxiosError: true, response: { status: 500, data: {} } }),
    );
    // Xatodan keyingi qayta so'rov ham eski holatni qaytaradi.
    open();
    await screen.findByText("Chilonzor");

    act(() => drag("2", "6"));

    await waitFor(() =>
      expect(
        within(screen.getByRole("region", { name: "Toshkent shahri" })).getByText("Chilonzor"),
      ).toBeInTheDocument(),
    );
    expect(
      within(screen.getByRole("region", { name: "Samarqand viloyati" })).queryByText("Chilonzor"),
    ).not.toBeInTheDocument();
  });

  it("kGvjztpY: after a successful move the refetch (assignedDistricts) keeps the district in the target region", async () => {
    // Backend 2026-11-01: `districts` — geografik (Chilonzor hali Toshkentda), `assignedDistricts` — biriktirilgan.
    const moved = [
      {
        ...REGIONS[0],
        assignedDistricts: [{ id: "3", name: "Mirobod", region: { id: "1", name: "Toshkent shahri" } }],
      },
      {
        ...REGIONS[1],
        assignedDistricts: [
          { id: "2", name: "Chilonzor", region: { id: "1", name: "Toshkent shahri" } },
          { id: "179", name: "Samarqand shahri", region: { id: "6", name: "Samarqand viloyati" } },
        ],
      },
    ];
    const { queryClient } = open();
    await screen.findByText("Chilonzor");
    // SATO sahifasidagi o'tkazish doskasi keshi ham eskiradi.
    const boardKey = ["regions", "with-districts"];
    queryClient.setQueryData(boardKey, []);
    const getsBefore = api.get.mock.calls.length;
    api.get.mockResolvedValue({ data: { statusCode: 200, data: moved } });

    act(() => drag("2", "6"));

    expect(await screen.findByText("Tuman boshqa viloyatga o'tkazildi")).toBeInTheDocument();
    expect(api.patch).toHaveBeenCalledWith("district/2", { assigned_region: "6" });
    await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThan(getsBefore));
    await waitFor(() => expect(queryClient.getQueryState(boardKey)?.isInvalidated).toBe(true));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    // Qayta yuklangandan keyin ham — Samarqandda (eski viloyatiga «sakrab» qaytmaydi).
    expect(
      within(screen.getByRole("region", { name: "Samarqand viloyati" })).getByText("Chilonzor"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Toshkent shahri" })).queryByText("Chilonzor"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("districts-count")).toHaveTextContent("3");
  });

  it("kGvjztpY: a failed move rolls back to the snapshot on the assignedDistricts path too", async () => {
    const assigned = REGIONS.map((region) => ({ ...region, assignedDistricts: region.districts }));
    api.get.mockResolvedValue({ data: { statusCode: 200, data: assigned } });
    api.patch.mockRejectedValue(
      Object.assign(new Error("fail"), { isAxiosError: true, response: { status: 500, data: {} } }),
    );
    open();
    await screen.findByText("Chilonzor");

    act(() => drag("2", "6"));

    expect((await screen.findAllByText("O'tkazib bo'lmadi — tuman joyiga qaytarildi")).length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(
        within(screen.getByRole("region", { name: "Toshkent shahri" })).getByText("Chilonzor"),
      ).toBeInTheDocument(),
    );
    expect(
      within(screen.getByRole("region", { name: "Samarqand viloyati" })).queryByText("Chilonzor"),
    ).not.toBeInTheDocument();
  });

  it("load error is shown on the page (ErrorState) and is not toasted globally again", async () => {
    api.get.mockRejectedValue(
      Object.assign(new Error("fail"), { isAxiosError: true, response: { status: 500, data: {} } }),
    );
    const { queryClient } = open();

    expect(await screen.findByText("Ma'lumotni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
    const [query] = queryClient.getQueryCache().getAll();
    expect(query?.meta?.silentError).toBe(true);
  });

  it("opens for admin too (owner S1: admin does everything) and redirects other roles to /regions", async () => {
    const { unmount } = open("admin");
    expect(await screen.findByText("Chilonzor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mirobodni o'chirish" })).toBeInTheDocument();
    unmount();
    vi.clearAllMocks();

    open("manager");
    expect(await screen.findByTestId("path")).toHaveTextContent("/regions");
    expect(api.get).not.toHaveBeenCalled();
  });

  it("shows a translated message (not the server text) when a name already exists (409, code owner 404)", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(httpError(409, "District already exists in this region"));
    api.get.mockImplementation((url: string) =>
      url === "district/sato/1726240"
        ? Promise.reject(httpError(404, "Tuman topilmadi"))
        : Promise.resolve({ data: { statusCode: 200, data: REGIONS } }),
    );
    open();
    await screen.findByText("Chilonzor");

    const form = screen.getByRole("region", { name: "Yangi tuman qo'shish" });
    await fillCreate(user, form, { name: "Chilonzor", region: "Toshkent shahri", code: "1726240" });

    const name = within(form).getByRole("textbox", { name: /Tuman nomi/ });
    expect(await within(form).findByText("Bu viloyatda shu nomli tuman bor")).toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(api.get).toHaveBeenCalledWith("district/sato/1726240");
    expect(screen.queryByText(/District already exists/)).not.toBeInTheDocument();
    // Qiymatlar saqlanadi; nom o'zgarsa xato yo'qoladi.
    expect(name).toHaveValue("Chilonzor");
    await user.type(name, " tumani");
    expect(within(form).queryByText("Bu viloyatda shu nomli tuman bor")).not.toBeInTheDocument();
  });
});

/** «Yangi tuman qo'shish» kartasini to'ldirib, «Qo'shish» ni bosadi. */
const fillCreate = async (
  user: ReturnType<typeof userEvent.setup>,
  form: HTMLElement,
  { name, region, code }: { name: string; region?: string; code?: string },
) => {
  await user.type(within(form).getByRole("textbox", { name: /Tuman nomi/ }), name);
  if (region) {
    await user.click(within(form).getByRole("combobox", { name: /Viloyat/ }));
    await user.click(await screen.findByRole("option", { name: region }));
  }
  if (code) await user.type(within(form).getByRole("textbox", { name: /SATO kodi/ }), code);
  await user.click(within(form).getByRole("button", { name: /Qo'shish/ }));
};

describe("RegionDistrictsPage — «Yangi tuman qo'shish»: SATO kodi majburiy (ExK28CiS)", () => {
  const SIRDARYO = { id: "11", name: "Sirdaryo viloyati", sato_code: null, districts: [] };
  beforeEach(() => {
    api.get.mockImplementation((url: string) =>
      url === "region"
        ? Promise.resolve({ data: { statusCode: 200, data: [...REGIONS, SIRDARYO] } })
        : Promise.reject(httpError(404, "Tuman topilmadi")),
    );
    api.post.mockResolvedValue({ data: { statusCode: 201 } });
  });
  afterEach(() => vi.clearAllMocks());

  const openForm = async () => {
    open();
    await screen.findByText("Chilonzor");
    return screen.getByRole("region", { name: "Yangi tuman qo'shish" });
  };

  it("«SATO kodi *» — majburiy, faqat raqam, 7 belgi; ko'rsatma viloyatga qarab", async () => {
    const user = userEvent.setup();
    const form = await openForm();
    const code = within(form).getByRole("textbox", { name: /SATO kodi/ });
    expect(code).toHaveAttribute("aria-required", "true");
    expect(code).toHaveAttribute("inputmode", "numeric");
    expect(code).toHaveAttribute("maxlength", "7");
    expect(within(form).getByText("7 ta raqam. Avval viloyatni tanlang.")).toBeInTheDocument();

    await user.type(code, "17a26");
    expect(code).toHaveValue("1726");
    await user.click(within(form).getByRole("combobox", { name: /Viloyat/ }));
    await user.click(await screen.findByRole("option", { name: "Toshkent shahri" }));
    expect(within(form).getByText("7 ta raqam, Toshkent shahri kodi 1726 bilan boshlanadi")).toBeInTheDocument();

    // Viloyatda kod yo'q — prefiks aytilmaydi.
    await user.click(within(form).getByRole("combobox", { name: /Viloyat/ }));
    await user.click(await screen.findByRole("option", { name: "Sirdaryo viloyati" }));
    expect(within(form).getByText("7 ta raqam")).toBeInTheDocument();
  });

  it("klient tekshiruvi: bo'sh kod, 7 raqam emas, boshqa viloyat prefiksi — POST ketmaydi, xato kod maydonida", async () => {
    const user = userEvent.setup();
    const form = await openForm();
    const code = within(form).getByRole("textbox", { name: /SATO kodi/ });

    await fillCreate(user, form, { name: "Yangi tuman", region: "Toshkent shahri" });
    expect(within(form).getByText("SATO kodini kiriting")).toBeInTheDocument();
    expect(code).toHaveAttribute("aria-invalid", "true");

    await user.type(code, "172624");
    expect(within(form).queryByText("SATO kodini kiriting")).not.toBeInTheDocument();
    await user.click(within(form).getByRole("button", { name: /Qo'shish/ }));
    expect(within(form).getByText("Kod 7 ta raqamdan iborat bo'lishi kerak")).toBeInTheDocument();

    await user.clear(code);
    await user.type(code, "1718240");
    await user.click(within(form).getByRole("button", { name: /Qo'shish/ }));
    expect(within(form).getByText("Kod 1726 bilan boshlanishi kerak — Toshkent shahri kodi")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    // Mos viloyatga almashsa — prefiks xatosi yo'qoladi; Samarqand kodi 1718 — yuboriladi.
    await user.click(within(form).getByRole("combobox", { name: /Viloyat/ }));
    await user.click(await screen.findByRole("option", { name: "Samarqand viloyati" }));
    expect(within(form).queryByText(/bilan boshlanishi kerak/)).not.toBeInTheDocument();
    await user.click(within(form).getByRole("button", { name: /Qo'shish/ }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("district", { name: "Yangi tuman", region_id: "6", sato_code: "1718240" }),
    );
  });

  it("viloyatda kod yo'q — prefiks tekshirilmaydi; server 400 region_prefix_mismatch — `expected_prefix` bilan", async () => {
    api.post.mockRejectedValue(
      httpError(400, "Tuman SOATO kodi viloyat SOATO kodi (1724) bilan boshlanishi kerak", {
        reason: "region_prefix_mismatch",
        details: { expected_prefix: "1724" },
      }),
    );
    const user = userEvent.setup();
    const form = await openForm();
    await fillCreate(user, form, { name: "Yangi tuman", region: "Sirdaryo viloyati", code: "1718240" });

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("district", { name: "Yangi tuman", region_id: "11", sato_code: "1718240" }),
    );
    expect(await within(form).findByText("Kod 1724 bilan boshlanishi kerak — Sirdaryo viloyati kodi")).toBeInTheDocument();
    expect(screen.queryByText(/viloyat SOATO kodi/)).not.toBeInTheDocument();
    expect(within(form).getByRole("textbox", { name: /SATO kodi/ })).toHaveValue("1718240");
  });

  it("409 + kod egasi topildi — «Bu kod band: <tuman>, <viloyat>» kod maydonida (server matnisiz)", async () => {
    api.post.mockRejectedValue(httpError(409, "Bunday SOATO kodli tuman allaqachon mavjud"));
    api.get.mockImplementation((url: string) =>
      url === "district/sato/1726262"
        ? Promise.resolve({
            data: { statusCode: 200, data: { id: "12", name: "Yangihayot tumani", region: { name: "Toshkent sh." } } },
          })
        : Promise.resolve({ data: { statusCode: 200, data: REGIONS } }),
    );
    const user = userEvent.setup();
    const form = await openForm();
    await fillCreate(user, form, { name: "Yangi tuman", region: "Toshkent shahri", code: "1726262" });

    expect(await within(form).findByText("Bu kod band: Yangihayot tumani, Toshkent sh.")).toBeInTheDocument();
    expect(within(form).getByRole("textbox", { name: /SATO kodi/ })).toHaveAttribute("aria-invalid", "true");
    expect(within(form).getByRole("textbox", { name: /Tuman nomi/ })).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(/allaqachon mavjud/)).not.toBeInTheDocument();
  });

  it("409 + kod egasini so'rash 5xx — umumiy xabar, «nom band» deb taxmin qilinmaydi", async () => {
    api.post.mockRejectedValue(httpError(409));
    api.get.mockImplementation((url: string) =>
      url === "region"
        ? Promise.resolve({ data: { statusCode: 200, data: REGIONS } })
        : Promise.reject(httpError(503, "Service Unavailable")),
    );
    const user = userEvent.setup();
    const form = await openForm();
    await fillCreate(user, form, { name: "Yangi tuman", region: "Toshkent shahri", code: "1726262" });

    expect((await screen.findAllByText("Tumanni qo'shib bo'lmadi")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Qayta urinib ko'ring.").length).toBeGreaterThan(0);
    expect(within(form).queryByText("Bu viloyatda shu nomli tuman bor")).not.toBeInTheDocument();
    expect(within(form).getByRole("textbox", { name: /Tuman nomi/ })).not.toHaveAttribute("aria-invalid", "true");
  });

  it("404 — «Viloyat topilmadi — ro'yxatni yangilang» viloyat maydonida; boshqa xato — umumiy xabar", async () => {
    api.post.mockRejectedValueOnce(httpError(404, "Viloyat topilmadi"));
    const user = userEvent.setup();
    const form = await openForm();
    await fillCreate(user, form, { name: "Yangi tuman", region: "Toshkent shahri", code: "1726240" });
    expect(await within(form).findByText("Viloyat topilmadi — ro'yxatni yangilang")).toBeInTheDocument();
    expect(screen.queryByText(/^Viloyat topilmadi$/)).not.toBeInTheDocument();

    api.post.mockRejectedValueOnce(httpError(500, "Internal server error"));
    await user.click(within(form).getByRole("button", { name: /Qo'shish/ }));
    expect((await screen.findAllByText("Tumanni qo'shib bo'lmadi")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Internal server error/)).not.toBeInTheDocument();
  });
});

const httpError = (status: number, message = "server matni", data?: unknown) =>
  Object.assign(new Error(message), {
    isAxiosError: true,
    response: { status, data: { statusCode: status, message, ...(data === undefined ? {} : { data }) } },
  });

const MERGED = {
  data: {
    statusCode: 200,
    message: "District merged",
    data: {
      from_district_id: "2",
      to_district_id: "3",
      moved: { orders: 130, users: 6, branches: 1 },
      moved_live: { orders: 128, users: 6, branches: 1 },
      target_before: { orders: 1126, users: 13, branches: 1, transfer_batches: 0, deleted: { orders: 0, users: 0, branches: 0, transfer_batches: 0 } },
      target_after: { orders: 1254, users: 19, branches: 2, transfer_batches: 0, deleted: { orders: 0, users: 0, branches: 0, transfer_batches: 0 } },
    },
  },
};

/** Chilonzorni o'chirishga urinadi (DELETE 400) → «o'chirib bo'lmaydi» → «Birlashtirish» → maqsad Mirobod. */
const openMergeForChilonzor = async (user: ReturnType<typeof userEvent.setup>) => {
  api.delete.mockRejectedValue(httpError(400, "Bu tumanda 128 ta buyurtma bor"));
  await screen.findByText("Chilonzor");
  await user.click(screen.getByRole("button", { name: "Chilonzorni o'chirish" }));
  const confirmDialog = await screen.findByRole("alertdialog", { name: "Chilonzor o'chirilsinmi?" });
  await user.click(within(confirmDialog).getByRole("button", { name: "O'chirish" }));

  const blocked = await screen.findByRole("alertdialog", { name: "Chilonzorni o'chirib bo'lmaydi" });
  await user.click(within(blocked).getByRole("button", { name: "Birlashtirish" }));
  const dialog = await screen.findByRole("dialog", { name: "Tumanni birlashtirish" });
  await user.click(within(dialog).getByRole("combobox", { name: /Maqsad tuman/ }));
  await user.click(await screen.findByRole("option", { name: "Mirobod" }));
  return dialog;
};

describe("RegionDistrictsPage — o'chirib bo'lmaydi va birlashtirish (DM-1, oNAE3LW9)", () => {
  beforeEach(() => {
    api.get.mockResolvedValue({ data: { statusCode: 200, data: REGIONS } });
    api.delete.mockResolvedValue({ data: { statusCode: 200 } });
  });
  afterEach(() => vi.clearAllMocks());

  it("DELETE 400 without data.usage opens «Tumanni o'chirib bo'lmaydi» by status only — no counts, no server text", async () => {
    const user = userEvent.setup();
    api.delete.mockRejectedValue(httpError(400, "Bu tumanda 128 ta buyurtma bor"));
    open("admin");
    await screen.findByText("Mirobod");

    await user.click(screen.getByRole("button", { name: "Mirobodni o'chirish" }));
    const confirmDialog = await screen.findByRole("alertdialog", { name: "Mirobod o'chirilsinmi?" });
    await user.click(within(confirmDialog).getByRole("button", { name: "O'chirish" }));

    const blocked = await screen.findByRole("alertdialog", { name: "Mirobodni o'chirib bo'lmaydi" });
    expect(api.delete).toHaveBeenCalledWith("district/3");
    expect(within(blocked).getByText("Toshkent shahri")).toBeInTheDocument();
    // Maket: tuman nomi 14 px (`.el-strong`), sarlavhadan (16 px) kichik.
    expect(within(blocked).getByText("Mirobod")).toHaveClass("text-sm");
    expect(within(blocked).getByText(/Birlashtirsangiz, bularning hammasi/)).toBeInTheDocument();
    expect(within(blocked).queryByText(/128/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bu tumanda 128 ta buyurtma bor/)).not.toBeInTheDocument();

    // Sarlavhadagi «×» va pastdagi «Yopish» — ikkalasi bir xil nomli; pastdagisi bosiladi.
    await user.click(within(blocked).getAllByRole("button", { name: "Yopish" }).at(-1)!);
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog", { name: "Mirobodni o'chirib bo'lmaydi" })).not.toBeInTheDocument(),
    );
  });

  it("other delete errors show the translated toast only", async () => {
    const user = userEvent.setup();
    api.delete.mockRejectedValue(httpError(503, "Hudud ishlatilishini tekshirib bo'lmadi"));
    open();
    await screen.findByText("Mirobod");

    await user.click(screen.getByRole("button", { name: "Mirobodni o'chirish" }));
    const confirmDialog = await screen.findByRole("alertdialog", { name: "Mirobod o'chirilsinmi?" });
    await user.click(within(confirmDialog).getByRole("button", { name: "O'chirish" }));

    expect((await screen.findAllByText("Tumanni o'chirib bo'lmadi")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/tekshirib bo'lmadi/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog", { name: /o'chirib bo'lmaydi/ })).not.toBeInTheDocument();
  });

  it("merges into a district of the same region only: confirm → progress (can't close) → result with counts", async () => {
    const user = userEvent.setup();
    let resolveMerge: (value: unknown) => void = () => undefined;
    api.post.mockReturnValue(
      new Promise((resolve) => {
        resolveMerge = resolve;
      }),
    );
    const { queryClient } = open("admin");
    // Boshqa ekranlarning keshi (tuman tanlagichi, viloyat statistikasi) — birlashtirishdan keyin eskiradi.
    const catalogKey = ["region-district-catalog", "1"];
    const statsKey = ["region-stats", undefined];
    queryClient.setQueryData(catalogKey, [{ id: "2", name: "Chilonzor" }]);
    queryClient.setQueryData(statsKey, { items: [] });
    // SATO tabi (SA-2) — o'chgan tumanga kod yozish / birlashtirish taklif qilinmasin.
    const satoKey = ["district-sato", "districts"];
    queryClient.setQueryData(satoKey, [{ id: "2", name: "Chilonzor" }]);
    await screen.findByText("Chilonzor");
    api.delete.mockRejectedValue(httpError(400));
    await user.click(screen.getByRole("button", { name: "Chilonzorni o'chirish" }));
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "Chilonzor o'chirilsinmi?" })).getByRole("button", {
        name: "O'chirish",
      }),
    );
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "Chilonzorni o'chirib bo'lmaydi" })).getByRole(
        "button",
        { name: "Birlashtirish" },
      ),
    );

    const dialog = await screen.findByRole("dialog", { name: "Tumanni birlashtirish" });
    expect(within(dialog).getByText("O'chiriladigan tuman")).toBeInTheDocument();
    expect(within(dialog).getByText("Faqat Toshkent shahri tumanlari. Chilonzorning o'zi ro'yxatda yo'q.")).toBeInTheDocument();
    const submit = within(dialog).getByRole("button", { name: "Birlashtirish" });
    expect(submit).toBeDisabled();

    // Ega S2: maqsad faqat shu viloyatdan — boshqa viloyat tumani va tumanning o'zi ro'yxatda yo'q.
    await user.click(within(dialog).getByRole("combobox", { name: /Maqsad tuman/ }));
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Mirobod"]);
    await user.click(options[0]);
    expect(within(dialog).getByText("Bu amalni qaytarib bo'lmaydi")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Birlashtirish" }));
    expect(api.post).toHaveBeenCalledWith(
      "district/2/merge",
      { target_district_id: "3" },
      { timeout: 125_000 },
    );

    const progress = await screen.findByRole("alertdialog", { name: "Birlashtirilmoqda…" });
    // Bosilgan «Birlashtirish» yo'qoldi — fokus `body` ga tushmaydi, panelda (ekran o'quvchi o'qiydi).
    await waitFor(() => expect(progress).toHaveFocus());
    expect(within(progress).getByText("O'tgan vaqt 0:00")).toBeInTheDocument();
    expect(within(progress).getByText("Oynani yopmang")).toBeInTheDocument();
    expect(within(progress).queryByRole("button", { name: "Yopish" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog", { name: "Birlashtirilmoqda…" })).toBeInTheDocument();
    // Jarayonda sahifani yopish brauzer tasdig'ini so'raydi.
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);

    const getsBefore = api.get.mock.calls.length;
    // Server Chilonzorni o'chirdi — qayta olingan ro'yxatda yo'q.
    api.get.mockResolvedValue({
      data: { statusCode: 200, data: [{ ...REGIONS[0], districts: [{ id: "3", name: "Mirobod" }] }, REGIONS[1]] },
    });
    await act(async () => resolveMerge(MERGED));

    const result = await screen.findByRole("dialog", { name: "Tumanlar birlashtirildi" });
    await waitFor(() => expect(result).toHaveFocus());
    await waitFor(() => expect(queryClient.getQueryState(catalogKey)?.isInvalidated).toBe(true));
    expect(queryClient.getQueryState(statsKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(satoKey)?.isInvalidated).toBe(true);
    const now = within(result).getByRole("list", { name: "Mirobodda endi" });
    expect(within(now).getByText("1 254 ta")).toHaveClass("text-sm");
    expect(within(now).getByText("oldin 1 126 ta")).toBeInTheDocument();
    expect(within(now).getByText("19 ta")).toBeInTheDocument();
    expect(within(now).getByText("2 ta")).toBeInTheDocument();
    // «Ko'chirildi» — faqat tirik (`moved_live` 128, vsmpTweI), jami `moved` (130) emas.
    const moved = within(result).getByRole("list", { name: "Ko'chirildi" });
    expect(within(moved).getByText("128 ta")).toBeInTheDocument();
    expect(within(moved).queryByText("130 ta")).not.toBeInTheDocument();
    expect(within(result).getByText("O'chirilgan yozuvlar sanalmaydi.")).toBeInTheDocument();
    await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThan(getsBefore));

    const afterUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterUnload);
    expect(afterUnload.defaultPrevented).toBe(false);

    await user.click(within(result).getAllByRole("button", { name: "Yopish" }).at(-1)!);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Tumanlar birlashtirildi" })).not.toBeInTheDocument(),
    );
    // Ochgan tugmalar («o'chirib bo'lmaydi» oynasi, Chilonzor qatori) yo'q — fokus qidiruv maydoniga.
    expect(screen.queryByText("Chilonzor")).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: /qidir/i })).toHaveFocus();
  });

  it("cancelling the merge opened from «o'chirib bo'lmaydi» returns focus to the delete button", async () => {
    const user = userEvent.setup();
    open();
    const dialog = await openMergeForChilonzor(user);
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Tumanni birlashtirish" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Chilonzorni o'chirish" })).toHaveFocus();
  });

  it("leaving the page during a merge and coming back reattaches to the same request (no second POST)", async () => {
    const user = userEvent.setup();
    let resolveMerge: (value: unknown) => void = () => undefined;
    api.post.mockReturnValue(
      new Promise((resolve) => {
        resolveMerge = resolve;
      }),
    );
    const first = open();
    const dialog = await openMergeForChilonzor(user);
    await user.click(within(dialog).getByRole("button", { name: "Birlashtirish" }));
    await screen.findByRole("alertdialog", { name: "Birlashtirilmoqda…" });
    // Brauzer/Android «Orqaga» — sahifa yopiladi, so'rov davom etadi.
    first.unmount();

    open();
    await screen.findByText("Chilonzor");
    await user.click(screen.getByRole("button", { name: "Chilonzorni o'chirish" }));
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "Chilonzor o'chirilsinmi?" })).getByRole("button", {
        name: "O'chirish",
      }),
    );
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "Chilonzorni o'chirib bo'lmaydi" })).getByRole(
        "button",
        { name: "Birlashtirish" },
      ),
    );
    expect(await screen.findByRole("alertdialog", { name: "Birlashtirilmoqda…" })).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);

    await act(async () => resolveMerge(MERGED));
    expect(await screen.findByRole("dialog", { name: "Tumanlar birlashtirildi" })).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("a timeout shows «Natija noma'lum» without «Qayta urinish»; «Tumanlarni yangilash» refetches", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(Object.assign(new Error("timeout"), { isAxiosError: true, code: "ECONNABORTED" }));
    open();
    const dialog = await openMergeForChilonzor(user);
    await user.click(within(dialog).getByRole("button", { name: "Birlashtirish" }));

    const unknown = await screen.findByRole("alertdialog", { name: "Natija noma'lum" });
    expect(within(unknown).getByText("Chilonzor → Mirobod")).toBeInTheDocument();
    expect(within(unknown).getByText("Natija aniq bo'lmaguncha qayta boshlamang.")).toBeInTheDocument();
    expect(within(unknown).getByRole("button", { name: "Faoliyat jurnalini ochish" })).toBeInTheDocument();
    expect(within(unknown).queryByRole("button", { name: /Qayta urinish/ })).not.toBeInTheDocument();

    const getsBefore = api.get.mock.calls.length;
    await user.click(within(unknown).getByRole("button", { name: "Tumanlarni yangilash" }));
    await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThan(getsBefore));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog", { name: "Natija noma'lum" })).not.toBeInTheDocument(),
    );
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("504 from the gateway is an unknown result too", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(httpError(504, "Yuqori oqim xizmati vaqtida javob bermadi (timeout)"));
    open();
    const dialog = await openMergeForChilonzor(user);
    await user.click(within(dialog).getByRole("button", { name: "Birlashtirish" }));

    expect(await screen.findByRole("alertdialog", { name: "Natija noma'lum" })).toBeInTheDocument();
    expect(screen.queryByText(/Yuqori oqim/)).not.toBeInTheDocument();
  });

  it("409/503 without machine-readable data close the dialog with a general error (no «returned» claim, no server text) and refetch", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(httpError(409, "Birlashtirish bekor qilindi: tekshiruv mos kelmadi — ..."));
    open();
    const dialog = await openMergeForChilonzor(user);
    const getsBefore = api.get.mock.calls.length;
    await user.click(within(dialog).getByRole("button", { name: "Birlashtirish" }));

    expect((await screen.findAllByText("Birlashtirib bo'lmadi")).length).toBeGreaterThan(0);
    // 409/503 da backend jurnalga yozmaydi — xabar bo'sh jurnalga yubormaydi, ro'yxatni tekshirishni aytadi.
    expect(
      screen.getAllByText("Tumanlar ro'yxati yangilandi: Chilonzor ro'yxatda turgan bo'lsa, birlashtirilmagan.").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/Faoliyat jurnalida tekshiring/)).not.toBeInTheDocument();
    expect(screen.queryByText(/tekshiruv mos kelmadi/)).not.toBeInTheDocument();
    expect(screen.queryByText(/qaytarildi/)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Tumanni birlashtirish" })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThan(getsBefore));
  });

  it("DELETE 400 data.usage → «Bog'langan» counts; the merge dialog starts from them", async () => {
    const user = userEvent.setup();
    api.delete.mockRejectedValue(
      httpError(400, "Bu tumanda 128 ta buyurtma bor", {
        reason: "district_in_use",
        usage: { orders: 128, users: 6, branches: 0, transfer_batches: 0 },
      }),
    );
    open("admin");
    await screen.findByText("Chilonzor");
    await user.click(screen.getByRole("button", { name: "Chilonzorni o'chirish" }));
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "Chilonzor o'chirilsinmi?" })).getByRole("button", {
        name: "O'chirish",
      }),
    );
    const blocked = await screen.findByRole("alertdialog", { name: "Chilonzorni o'chirib bo'lmaydi" });
    const linked = within(blocked).getByRole("list", { name: "Tumanga bog'langanlar" });
    expect(within(linked).getAllByRole("listitem").map((row) => row.textContent)).toEqual([
      "Buyurtmalar128 ta",
      "FoydalanuvchilarMijoz, kuryer va market6 ta",
    ]);
    expect(screen.queryByText(/Bu tumanda 128 ta buyurtma bor/)).not.toBeInTheDocument();
  });

  it("409 with data.reason → «Birlashtirib bo'lmadi» dialog with «Sabab»; «Qayta urinish» resends the same pair", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValueOnce(
      httpError(409, "Birlashtirish bekor qilindi: tekshiruv mos kelmadi — ...", {
        reason: "count_mismatch",
        details: {
          reason: "count_mismatch",
          kind: "orders",
          mismatches: [{ kind: "orders", district: "target", expected: 1254, actual: 1255 }],
          from_district_id: "2",
          to_district_id: "3",
          manual_fix: false,
        },
      }),
    );
    open();
    const dialog = await openMergeForChilonzor(user);
    await user.click(within(dialog).getByRole("button", { name: "Birlashtirish" }));

    const error = await screen.findByRole("alertdialog", { name: "Birlashtirib bo'lmadi" });
    expect(error).toHaveTextContent("Ko'chirilganlar Chilonzorga qaytarildi, tuman o'chirilmadi.");
    expect(error.textContent?.replace(/\s/g, " ")).toContain(
      "Sonlar mos kelmadi — Mirobodda buyurtmalar 1 255 ta, kutilgan 1 254 ta.",
    );
    expect(screen.queryByText(/tekshiruv mos kelmadi/)).not.toBeInTheDocument();

    api.post.mockResolvedValueOnce(MERGED);
    await user.click(within(error).getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByRole("dialog", { name: "Tumanlar birlashtirildi" })).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(api.post).toHaveBeenLastCalledWith("district/2/merge", { target_district_id: "3" }, { timeout: 125_000 });
  });
});
