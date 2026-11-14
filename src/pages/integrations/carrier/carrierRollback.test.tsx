import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { renderWithProviders } from "../../../test/test-utils";
import uz from "../../../locales/uz/integrations.json";
import ru from "../../../locales/ru/integrations.json";
import en from "../../../locales/en/integrations.json";

/**
 * ROLLBACK RUXSATI (ega so'rovi 2026-11-14) — akkaunt tafsilotidagi bitta kalit, sukut o'chiq, tasdiq bilan
 * (`PATCH admin/carriers/:id { rollback_enabled }`). Kompaniyaga ko'rsatiladigan matnda rollback yo'q.
 * `notify` / `confirm` mock qilinmaydi — haqiqiy UI; konsol `<StrictMode>` ichida (ilovadagidek).
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));

vi.mock("../../../shared/api/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../shared/api/api")>();
  return {
    ...original,
    api: { ...original.api, get: mocks.get, post: mocks.post, patch: mocks.patch },
  };
});

import { CarrierConsole } from "./CarrierConsole";

const httpError = (status: number, message: string) => {
  const error = new AxiosError("Request failed");
  error.response = {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { statusCode: status, message },
  };
  return error;
};

const FAST_POST = {
  id: "3",
  name: "FastPost Logistics",
  courier_user_id: "55",
  ip_allowlist: ["203.0.113.10"],
  is_active: true,
  rollback_enabled: false,
  createdAt: "2026-11-09T05:15:00.000Z",
  updatedAt: "2026-11-10T04:40:00.000Z",
};

/** 3 — o'chiq (sukut), 2 — yoqiq, 1 — eski backend (maydon yo'q). */
const ACCOUNTS: Array<Record<string, unknown>> = [
  FAST_POST,
  {
    id: "2",
    name: "Samarqand Ekspress",
    courier_user_id: "66",
    ip_allowlist: null,
    is_active: true,
    rollback_enabled: true,
    createdAt: "2026-11-06T10:40:00.000Z",
    updatedAt: "2026-11-06T10:40:00.000Z",
  },
  {
    id: "1",
    name: "Vodiy Kargo",
    courier_user_id: "77",
    ip_allowlist: null,
    is_active: false,
    createdAt: "2026-11-03T06:20:00.000Z",
    updatedAt: "2026-11-03T06:20:00.000Z",
  },
];

const USERS: Record<string, Record<string, unknown>> = {
  "55": {
    id: "55",
    name: "FastPost kuryeri",
    phone_number: "+998909774040",
    status: "active",
    role: "courier",
    branch: { id: "1", name: "Toshkent HQ" },
  },
  "66": {
    id: "66",
    name: "Samarqand Ekspress kuryeri",
    phone_number: "+998972140866",
    status: "active",
    role: "courier",
    branch: { id: "1", name: "Toshkent HQ" },
  },
  "77": {
    id: "77",
    name: "Vodiy Kargo kuryeri",
    phone_number: "+998913306214",
    status: "active",
    role: "courier",
    branch: { id: "1", name: "Toshkent HQ" },
  },
};

const routeGet = (url: string) => {
  if (url === "admin/carriers")
    return Promise.resolve({
      data: { statusCode: 200, message: "carrier accounts", data: ACCOUNTS },
    });
  if (url === "branches/hq")
    return Promise.resolve({
      data: { statusCode: 200, data: { id: "1", name: "Toshkent HQ", type: "HQ" } },
    });
  const user = /^users\/(\d+)$/.exec(url);
  if (user && USERS[user[1]])
    return Promise.resolve({ data: { statusCode: 200, data: USERS[user[1]] } });
  return Promise.reject(httpError(404, "Topilmadi"));
};

const listCalls = () =>
  mocks.get.mock.calls.filter(([called]) => called === "admin/carriers").length;

const SUPERADMIN = { role: { id: "1", role: "superadmin", region: null, name: "SA" } } as never;

const open = (search = "?scope=carrier") =>
  renderWithProviders(
    <StrictMode>
      <CarrierConsole tabs={null} />
    </StrictMode>,
    { route: `/integrations/connections${search}`, preloadedState: SUPERADMIN },
  );

/** Tafsilot kartasidagi kalit (modal ochiq bo'lsa sahifa `aria-hidden` — `hidden: true` bilan ham topiladi). */
const rollbackSwitch = (options?: { hidden?: boolean }) =>
  screen.getByRole("switch", { name: "Rollback ruxsati", ...options });

const patched = (account: Record<string, unknown>) => ({
  data: { statusCode: 200, message: "carrier account updated", data: account },
});

const deferred = () => {
  let release: (value: unknown) => void = () => {};
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release: (value: unknown) => release(value) };
};

const HINT =
  "O'chiq bo'lsa, kompaniya yuborgan rollback rad etiladi — xato natijani Elchi operatori tuzatadi. Bu imkoniyat kompaniyaga hujjatlarda ko'rsatilmaydi.";

describe("Tashqi yetkazuvchi — «Rollback ruxsati» kaliti", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.post.mockReset();
    mocks.patch.mockReset();
    mocks.get.mockImplementation((url: string) => routeGet(String(url)));
  });

  it("⭐ holat backend'dan: o'chiq (sukut) va yoqiq; izoh admin uchun, «Ulanish holati» bo'limida", async () => {
    const { unmount } = open();
    const detail = await screen.findByRole("region", { name: /FastPost Logistics/ });
    const toggle = within(detail).getByRole("switch", { name: "Rollback ruxsati" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toBeEnabled();
    expect(toggle).toHaveTextContent("O'chiq");
    expect(toggle).toHaveAccessibleDescription(HINT);
    // «To'xtatish» bilan bir bo'limda (kill-switch yonida).
    const section = toggle.closest("section") as HTMLElement;
    expect(within(section).getByText("Ulanish holati")).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "To'xtatish" })).toBeInTheDocument();
    unmount();

    open("?scope=carrier&c=carrier:2");
    const samarqand = await screen.findByRole("region", { name: /Samarqand Ekspress/ });
    const on = within(samarqand).getByRole("switch", { name: "Rollback ruxsati" });
    expect(on).toHaveAttribute("aria-checked", "true");
    expect(on).toHaveTextContent("Yoqiq");
  });

  it("⭐ backend maydonni bermasa (eski versiya) — o'chiq, kalit o'chirilgan, «Backend yangilanishi kerak»; bosish hech narsa qilmaydi", async () => {
    const user = userEvent.setup();
    open("?scope=carrier&c=carrier:1");
    const detail = await screen.findByRole("region", { name: /Vodiy Kargo/ });
    const toggle = within(detail).getByRole("switch", { name: "Rollback ruxsati" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toBeDisabled();
    expect(within(detail).getByText("Backend yangilanishi kerak")).toBeInTheDocument();
    expect(toggle).toHaveAccessibleDescription(`${HINT} Backend yangilanishi kerak`);
    await user.click(toggle);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("⭐ yoqish — tasdiq oynasi; «Bekor qilish» so'rov yubormaydi; tasdiqlansa PATCH { rollback_enabled: true }, kesh javobdan (ro'yxat qayta so'ralmaydi)", async () => {
    const user = userEvent.setup();
    mocks.patch.mockResolvedValue(
      patched({ ...FAST_POST, rollback_enabled: true, updatedAt: "2026-11-11T08:30:00.000Z" }),
    );
    open();
    await screen.findByRole("region", { name: /FastPost Logistics/ });

    await user.click(rollbackSwitch());
    let confirm = await screen.findByRole("alertdialog", { name: "Rollback ruxsatini yoqish" });
    expect(confirm).toHaveTextContent("«FastPost Logistics» yuborgan natijasini qaytara oladi");
    expect(confirm).toHaveTextContent("Pul va buyurtma holatiga ta'sir qiladi");
    expect(confirm).toHaveTextContent("Yoqsangiz, kompaniyaga o'zingiz xabar bering.");
    await user.click(within(confirm).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(rollbackSwitch()).toHaveAttribute("aria-checked", "false");

    await user.click(rollbackSwitch());
    confirm = await screen.findByRole("alertdialog", { name: "Rollback ruxsatini yoqish" });
    const before = listCalls();
    await user.click(within(confirm).getByRole("button", { name: "Yoqish" }));
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith("admin/carriers/3", { rollback_enabled: true }),
    );
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("«FastPost Logistics»: rollback yoqildi")).toBeInTheDocument();
    await waitFor(() => expect(rollbackSwitch()).toHaveAttribute("aria-checked", "true"));
    expect(rollbackSwitch()).toHaveTextContent("Yoqiq");
    // Javob keshga yozildi — «Oxirgi o'zgarish» ham javobdan; `admin/carriers` qayta so'ralmadi.
    expect(screen.getByRole("region", { name: /FastPost Logistics/ })).toHaveTextContent(
      "Oxirgi o'zgarish 11.11.2026, 13:30",
    );
    expect(listCalls()).toBe(before);
  });

  it("⭐ o'chirish — tasdiq oynasi oqibatlari bilan; PATCH { rollback_enabled: false }", async () => {
    const user = userEvent.setup();
    mocks.patch.mockResolvedValue(patched({ ...ACCOUNTS[1], rollback_enabled: false }));
    open("?scope=carrier&c=carrier:2");
    await screen.findByRole("region", { name: /Samarqand Ekspress/ });

    await user.click(rollbackSwitch());
    const confirm = await screen.findByRole("alertdialog", {
      name: "Rollback ruxsatini o'chirish",
    });
    expect(confirm).toHaveTextContent("«Samarqand Ekspress» yuborgan rollback rad etiladi");
    expect(confirm).toHaveTextContent("400 bilan rad etiladi — noma'lum holat qiymati kabi");
    expect(confirm).toHaveTextContent("Avval qaytarilgan buyurtmalar va kassa yozuvlari");
    await user.click(within(confirm).getByRole("button", { name: "O'chirish" }));
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith("admin/carriers/2", { rollback_enabled: false }),
    );
    expect(await screen.findByText("«Samarqand Ekspress»: rollback o'chirildi")).toBeInTheDocument();
    await waitFor(() => expect(rollbackSwitch()).toHaveAttribute("aria-checked", "false"));
  });

  it("⭐ xato — backend matni bilan xabar, kalit o'zgarmaydi, ro'yxat serverdan qayta o'qiladi", async () => {
    const user = userEvent.setup();
    mocks.patch.mockRejectedValue(httpError(500, "Ichki xato yuz berdi"));
    open();
    await screen.findByRole("region", { name: /FastPost Logistics/ });
    await user.click(rollbackSwitch());
    const confirm = await screen.findByRole("alertdialog", { name: "Rollback ruxsatini yoqish" });
    const before = listCalls();
    await user.click(within(confirm).getByRole("button", { name: "Yoqish" }));
    expect(await screen.findByText("Ichki xato yuz berdi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(rollbackSwitch()).toHaveAttribute("aria-checked", "false");
    expect(rollbackSwitch()).toBeEnabled();
    await waitFor(() => expect(listCalls()).toBeGreaterThan(before));
  });

  it("javob so'ralgan qiymatni tasdiqlamasa (maydon yo'q) — «Natija tasdiqlanmadi», ro'yxat qayta o'qiladi", async () => {
    const user = userEvent.setup();
    const { rollback_enabled: _omitted, ...withoutFlag } = FAST_POST;
    void _omitted;
    mocks.patch.mockResolvedValue(patched(withoutFlag));
    open();
    await screen.findByRole("region", { name: /FastPost Logistics/ });
    await user.click(rollbackSwitch());
    const confirm = await screen.findByRole("alertdialog", { name: "Rollback ruxsatini yoqish" });
    const before = listCalls();
    await user.click(within(confirm).getByRole("button", { name: "Yoqish" }));
    expect(await screen.findByText("Natija tasdiqlanmadi")).toBeInTheDocument();
    expect(screen.queryByText("«FastPost Logistics»: rollback yoqildi")).not.toBeInTheDocument();
    await waitFor(() => expect(listCalls()).toBeGreaterThan(before));
    // Ro'yxat qayta o'qildi — baza qiymati (o'chiq) ko'rinadi.
    await waitFor(() => expect(rollbackSwitch()).toHaveAttribute("aria-checked", "false"));
  });

  it("⭐ so'rov ketayotganda — kalit aria-busy va o'chirilgan, oyna yopilmaydi; javob kelgach yangi holat", async () => {
    const user = userEvent.setup();
    const request = deferred();
    mocks.patch.mockReturnValue(request.promise);
    open();
    await screen.findByRole("region", { name: /FastPost Logistics/ });
    await user.click(rollbackSwitch());
    const confirm = await screen.findByRole("alertdialog", { name: "Rollback ruxsatini yoqish" });
    await user.click(within(confirm).getByRole("button", { name: "Yoqish" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));

    await waitFor(() =>
      expect(rollbackSwitch({ hidden: true })).toHaveAttribute("aria-busy", "true"),
    );
    expect(rollbackSwitch({ hidden: true })).toBeDisabled();
    expect(within(confirm).getByRole("button", { name: "Bekor qilish" })).toBeDisabled();
    // Esc ham yopmaydi — natija kutilmoqda.
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog", { name: "Rollback ruxsatini yoqish" })).toBeInTheDocument();

    await act(async () => request.release(patched({ ...FAST_POST, rollback_enabled: true })));
    expect(await screen.findByText("«FastPost Logistics»: rollback yoqildi")).toBeInTheDocument();
    await waitFor(() => expect(rollbackSwitch()).toHaveAttribute("aria-checked", "true"));
    expect(rollbackSwitch()).not.toHaveAttribute("aria-busy");
    expect(rollbackSwitch()).toBeEnabled();
  });

  it("⭐ klaviatura — Space kalitni bosadi, fokus xavfsiz tugmada; Esc yopadi va fokus kalitga qaytadi", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole("region", { name: /FastPost Logistics/ });
    const toggle = rollbackSwitch();
    act(() => toggle.focus());
    await user.keyboard(" ");
    const confirm = await screen.findByRole("alertdialog", { name: "Rollback ruxsatini yoqish" });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(confirm).getByRole("button", { name: "Bekor qilish" }),
      ),
    );
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(rollbackSwitch()));
    expect(mocks.patch).not.toHaveBeenCalled();
  });
});

describe("Kompaniyaga beriladigan matnda rollback yo'q (ega qarori 2026-11-14)", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.get.mockImplementation((url: string) => routeGet(String(url)));
  });

  it("⭐ «Kompaniya dasturchisi uchun» — holat endpointi faqat sold · partly_sold · cancelled", async () => {
    open();
    const list = await screen.findByRole("list", { name: "Carrier API endpointlari" });
    expect(list).toHaveTextContent("sold · partly_sold · cancelled; Idempotency-Key majburiy");
    expect(list).not.toHaveTextContent(/rollback/i);
  });

  /**
   * Kompaniya dasturchisiga beriladigan matnlar: tafsilotdagi «Kompaniya dasturchisi uchun» bloki (`detail.dev*`,
   * `detail.api*`) va kalit oynasidagi «Kompaniya dasturchisiga bering» qadamlari (`key.*`). Admin izohi
   * (`carrier.rollback.*`) — ichki, tekshirilmaydi.
   */
  it.each([
    ["uz", uz],
    ["ru", ru],
    ["en", en],
  ])("⭐ %s: detail.dev* / detail.api* / key.* matnlarida «rollback» yo'q", (_lang, locale) => {
    const carrier = locale.carrier as {
      detail: Record<string, string>;
      key: Record<string, string>;
    };
    const companyFacing = [
      ...Object.entries(carrier.detail).filter(([key]) => /^(dev|api)/.test(key)),
      ...Object.entries(carrier.key),
    ];
    expect(companyFacing.length).toBeGreaterThan(20);
    const leaks = companyFacing.filter(([, value]) => /rollback/i.test(value));
    expect(leaks).toEqual([]);
  });
});
