import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConnectionLog from "./ConnectionLog";
import { renderWithProviders } from "../../../test/test-utils";
import type { Connection } from "../useConnections";

/**
 * HODISALAR TABI — BITTA VAQTDA BITTA JADVAL.
 *
 * ⚠️ NIMA BUZILGAN EDI. Chiquvchi va kiruvchi jurnallar (to'lov tizimida
 * ustiga to'lovlar ro'yxati) BIRDAN, ustma-ust chizilardi. Bir ekranda
 * UCHTA "Yangilash" tugmasi, UCHTA filtr qatori va uchta jadval turardi:
 * operator qaysi filtr qaysi jadvalga tegishli ekanini taxmin qilardi.
 *
 * ⚠️ BITTA UMUMIY JADVALGA BIRLASHTIRILMADI — ataylab. Maydonlari umuman
 * boshqa (yetkazish urinishlari / sinxron qilingan buyurtma soni / to'lov
 * summasi); umumlashtirilgan ustunlar uchalasining ma'nosini yo'qotardi.
 */

const apiGetMock = vi.fn();

vi.mock("../../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiGetMock(...args),
  },
}));

const conn = (over: Partial<Connection> = {}): Connection =>
  ({
    uid: "integration:12",
    kind: "integration",
    id: "12",
    name: "Payme",
    role: "payment",
    category: "payment",
    is_active: true,
    subtitle: "",
    raw: { slug: "payme" },
    ...over,
  }) as Connection;

/** Ekranda nechta "Yangilash" tugmasi bor. */
const refreshCount = () =>
  Array.from(document.querySelectorAll("button")).filter((b) =>
    /Yangilash/i.test(b.textContent ?? ""),
  ).length;

const clickView = async (label: RegExp) => {
  const user = userEvent.setup();
  const node = Array.from(document.querySelectorAll("label, .ant-segmented-item")).find((el) =>
    label.test(el.textContent ?? ""),
  );
  if (!node) throw new Error(`"${label}" ko'rinishi topilmadi`);
  await user.click(node);
};

describe("Hodisalar tabi — ko'rinish almashtirgichi", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue({ data: { data: { items: [], meta: {} } } });
  });

  it("⭐ EKRANDA BITTA 'Yangilash' bo'ladi", async () => {
    /**
     * Asosiy tekshiruv: ilgari uchta edi. Bu son bilvosita "bitta jadval"
     * ni ham isbotlaydi — har bir ko'rinish o'z tugmasini olib yuradi.
     */
    renderWithProviders(<ConnectionLog connection={conn()} />);
    await waitFor(() => expect(refreshCount()).toBe(1));
  });

  it("⭐ to'lov tizimida UCH ko'rinish taklif qiladi", async () => {
    renderWithProviders(<ConnectionLog connection={conn()} />);

    await waitFor(() => expect(screen.getByText(/Onlayn to'lovlar/)).toBeTruthy());
    expect(screen.getByText(/Kiruvchi webhooklar/)).toBeTruthy();
    expect(screen.getByText(/Sinxron tarixi/)).toBeTruthy();
  });

  it("⭐ to'lov BO'LMAGAN ulanishda pul ko'rinishi YO'Q", async () => {
    /**
     * Pul ro'yxati faqat to'lov rolida ma'noli. Boshqa rolda ko'rsatsak
     * operator bo'sh jadval ko'rib "buzuqmi?" deb o'ylardi.
     */
    renderWithProviders(
      <ConnectionLog connection={conn({ role: "carrier", category: "cargo" })} />,
    );

    await waitFor(() => expect(screen.getByText(/Kiruvchi webhooklar/)).toBeTruthy());
    expect(screen.queryByText(/Onlayn to'lovlar/)).toBeNull();
    // Almashtirgich baribir bitta "Yangilash" qoldiradi.
    expect(refreshCount()).toBe(1);
  });

  it("⭐ ko'rinish almashganda jadval ALMASHADI", async () => {
    renderWithProviders(<ConnectionLog connection={conn()} />);

    // Boshlanishda to'lovlar ko'rinishi — banner shundan bilinadi.
    await waitFor(() => expect(screen.getByText(/kassaga yozilmaydi/)).toBeTruthy());

    await clickView(/Sinxron tarixi/);

    await waitFor(() => expect(screen.queryByText(/kassaga yozilmaydi/)).toBeNull());
    // Almashgandan keyin ham bitta tugma.
    expect(refreshCount()).toBe(1);
  });

  it("hamkorda almashtirgich KO'RSATILMAYDI", async () => {
    /**
     * Hamkorda yagona ko'rinish bor (biz yuborgan hodisalar) — bitta
     * variantli almashtirgich shovqin bo'lardi.
     */
    renderWithProviders(
      <ConnectionLog connection={conn({ kind: "partner", uid: "partner:7", id: "7" })} />,
    );

    await waitFor(() => expect(refreshCount()).toBe(1));
    expect(screen.queryByText(/Sinxron tarixi/)).toBeNull();
    expect(screen.queryByText(/Kiruvchi webhooklar/)).toBeNull();
  });
});
