import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils";
import OrderMeta from "./OrderMeta";
import OrderParentBanner from "./OrderParentBanner";

/**
 * BUYURTMA MA'LUMOTLARI widgeti.
 *
 * ⚠️ `getByRole` ISHLATILMAYDI (antd CSS-in-JS jsdom'da selektor xatosi) —
 * elementlar `data-testid`, matn va atributlar bo'yicha topiladi.
 */

const apiGet = vi.hoisted(() => vi.fn());
vi.mock("../../../shared/api/api", () => ({ api: { get: apiGet } }));

const ORDER_95 = {
  id: "95",
  where_deliver: "center",
  market: { id: "m7", name: "Kimdur Kimdur", phone_number: "+998992222222" },
  market_tariff: 70000,
  courier_tariff: 25000,
  courier_share: 25000,
  branch_share: 0,
  courier_id: "93",
  post_id: "78",
  holder_type: "COURIER",
  holder_courier_id: "93",
  sold_at: "1784557174975",
  branch: { id: "1", name: "HQ Toshkent" },
};

const row = (id: string) => screen.getByTestId(id);
const tariffValue = (field: string) =>
  document.querySelector<HTMLElement>(`[data-tariff="${field}"] dd`)!;

describe("OrderMeta", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === "users/93") {
        return Promise.resolve({ data: { statusCode: 200, data: { id: "93", name: "Xorazm Courier", phone_number: "+998970000090" } } });
      }
      if (url === "branches/12") return Promise.resolve({ data: { statusCode: 200, data: { id: "12", name: "Urganch filiali" } } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
  });

  it("⭐ admin: ID (nusxalash), market + tel, filial, pochta havolasi, kuryer + tel, hozir kimda, yetkazish turi", async () => {
    renderWithProviders(<OrderMeta order={ORDER_95} role="admin" canOpenMails />);

    expect(row("meta-id")).toHaveTextContent("#95");
    expect(row("meta-id").querySelector('button[aria-label="Buyurtma raqamini nusxalash"]')).toBeTruthy();
    expect(row("meta-market")).toHaveTextContent("Kimdur Kimdur");
    expect(row("meta-market").querySelector("a")!.getAttribute("href")).toBe("tel:+998992222222");
    expect(row("meta-branch")).toHaveTextContent("HQ Toshkent");
    expect(row("meta-post").querySelector("a")!.getAttribute("href")).toBe("/mails/78");
    expect(row("meta-delivery")).toHaveTextContent("Markaz");
    expect(row("meta-sold-at").textContent).toMatch(/2026/);

    // Kuryer nomi va telefoni `GET users/93` dan — bosiladigan tel: havola.
    await waitFor(() => expect(row("meta-courier")).toHaveTextContent("Xorazm Courier"));
    expect(row("meta-courier").querySelector("a")!.getAttribute("href")).toBe("tel:+998970000090");
    expect(row("meta-holder")).toHaveTextContent("Kuryerda: Xorazm Courier");
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it("⭐ tarif sukut bo'yicha XIRA, ko'z tugmasi ochadi va yopadi (admin — hammasi)", () => {
    renderWithProviders(<OrderMeta order={ORDER_95} role="admin" />);
    const block = screen.getByTestId("meta-tariffs");
    expect(block.querySelectorAll("[data-tariff]")).toHaveLength(4);

    expect(tariffValue("marketTariff")).toHaveClass("blur-sm");
    expect(tariffValue("marketTariff")).toHaveAttribute("aria-hidden", "true");
    const toggle = block.querySelector<HTMLButtonElement>("button[aria-pressed]")!;
    expect(toggle).toHaveAttribute("aria-label", "Tarifni ko'rsatish");

    fireEvent.click(toggle);
    expect(tariffValue("marketTariff")).not.toHaveClass("blur-sm");
    expect(tariffValue("marketTariff").textContent).toMatch(/70\s000 so'm/);
    expect(tariffValue("courierTariff").textContent).toMatch(/25\s000 so'm/);
    // Haqiqiy 0 — "0 so'm", yo'q qiymat emas.
    expect(tariffValue("branchShare").textContent).toMatch(/^0 so'm$/);
    expect(toggle).toHaveAttribute("aria-label", "Tarifni yashirish");

    fireEvent.click(toggle);
    expect(tariffValue("marketTariff")).toHaveClass("blur-sm");
  });

  it("⭐ superadmin — 70 000 / 25 000 (market va kuryer tarifi) ko'rinadi", () => {
    renderWithProviders(<OrderMeta order={ORDER_95} role="superadmin" />);
    fireEvent.click(screen.getByTestId("meta-tariffs").querySelector("button[aria-pressed]")!);
    expect(tariffValue("marketTariff").textContent).toMatch(/^70\s000 so'm$/);
    expect(tariffValue("courierTariff").textContent).toMatch(/^25\s000 so'm$/);
  });

  it("⭐ sotilgan vaqt Toshkent zonasida va timeline bilan AYNI formatda", () => {
    renderWithProviders(<OrderMeta order={{ ...ORDER_95, sold_at: "2026-07-19T20:30:00.000Z" }} role="admin" />);
    expect(row("meta-sold-at")).toHaveTextContent("20.07.2026, 01:30:00");
  });

  it("⭐ har qatorda yorliq va qiymat BIR qatorda (yorliq qisqarmaydi, qiymat kesiladi, title'da to'liq)", () => {
    renderWithProviders(<OrderMeta order={ORDER_95} role="market" />);
    for (const id of ["meta-id", "meta-market", "meta-branch", "meta-post", "meta-courier", "meta-holder"]) {
      const label = row(id).querySelector("[data-meta-label]")!;
      const value = row(id).querySelector("[data-meta-value]")!;
      expect(label.className, id).toContain("whitespace-nowrap");
      expect(label.className, id).toContain("shrink-0");
      expect(value.className, id).toContain("whitespace-nowrap");
      expect(label.parentElement, id).toBe(value.parentElement);
    }
    expect(row("meta-market").querySelector("[data-meta-value]")!.getAttribute("title")).toBe(
      "Kimdur Kimdur · +998992222222",
    );
  });

  it("market — faqat market tarifi; kuryer kontakti so'ralmaydi (403 bo'lardi), #id ko'rinadi", () => {
    renderWithProviders(<OrderMeta order={ORDER_95} role="market" />);
    const block = screen.getByTestId("meta-tariffs");
    expect(Array.from(block.querySelectorAll("[data-tariff]")).map((el) => el.getAttribute("data-tariff"))).toEqual([
      "marketTariff",
    ]);
    expect(row("meta-courier")).toHaveTextContent("#93");
    expect(apiGet).not.toHaveBeenCalled();
    // Pochtaga ruxsat yo'q — raqam havola emas.
    expect(row("meta-post").querySelector("a")).toBeNull();
    expect(row("meta-post")).toHaveTextContent("#78");
  });

  it("kuryer — faqat kuryer tarifi; o'z buyurtmasida O'Z kontakti (so'rovsiz)", () => {
    renderWithProviders(
      <OrderMeta order={ORDER_95} role="courier" self={{ id: "93", name: "Men Kuryer", phone_number: "+998901112233" }} />,
    );
    expect(
      Array.from(screen.getByTestId("meta-tariffs").querySelectorAll("[data-tariff]")).map((el) =>
        el.getAttribute("data-tariff"),
      ),
    ).toEqual(["courierTariff"]);
    expect(row("meta-courier")).toHaveTextContent("Men Kuryer");
    expect(row("meta-courier").querySelector("a")!.getAttribute("href")).toBe("tel:+998901112233");
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("registrator — tarif bloki UMUMAN yo'q", () => {
    renderWithProviders(<OrderMeta order={ORDER_95} role="registrator" />);
    expect(screen.queryByTestId("meta-tariffs")).not.toBeInTheDocument();
  });

  it("o'lchanmagan tarif \"—\", 0 emas", () => {
    renderWithProviders(<OrderMeta order={{ ...ORDER_95, market_tariff: null }} role="admin" />);
    fireEvent.click(screen.getByTestId("meta-tariffs").querySelector("button[aria-pressed]")!);
    expect(tariffValue("marketTariff").textContent).toBe("—");
  });

  it("hozir kimda: HQ / MARKET / uy filiali (nomi javobdan) / boshqa filial (admin so'raydi)", async () => {
    const { unmount } = renderWithProviders(<OrderMeta order={{ ...ORDER_95, holder_type: "HQ" }} role="admin" />);
    expect(row("meta-holder")).toHaveTextContent("Bosh ofisda (HQ)");
    unmount();

    const second = renderWithProviders(<OrderMeta order={{ ...ORDER_95, holder_type: "MARKET" }} role="admin" />);
    expect(row("meta-holder")).toHaveTextContent("Marketga qaytarilgan");
    second.unmount();

    const third = renderWithProviders(
      <OrderMeta order={{ ...ORDER_95, holder_type: "BRANCH", holder_branch_id: "1" }} role="admin" />,
    );
    expect(row("meta-holder")).toHaveTextContent("Filialda: HQ Toshkent");
    third.unmount();

    renderWithProviders(<OrderMeta order={{ ...ORDER_95, holder_type: "BRANCH", holder_branch_id: "12" }} role="admin" />);
    await waitFor(() => expect(row("meta-holder")).toHaveTextContent("Filialda: Urganch filiali"));
  });

  it("kuryer biriktirilmagan — \"Hali biriktirilmagan\"", () => {
    renderWithProviders(<OrderMeta order={{ ...ORDER_95, courier_id: null, holder_type: "HQ" }} role="admin" />);
    expect(row("meta-courier")).toHaveTextContent("Hali biriktirilmagan");
  });

  it("nom so'rovi yiqilsa — #id qoladi (yolg'on nom emas)", async () => {
    apiGet.mockImplementation(() => Promise.reject(new Error("403")));
    renderWithProviders(<OrderMeta order={ORDER_95} role="manager" />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(row("meta-courier")).toHaveTextContent("#93");
    expect(within(row("meta-courier")).queryByText(/Courier/)).not.toBeInTheDocument();
  });
});

describe("OrderParentBanner", () => {
  it("parent_order_id bo'lsa — matn va asosiy buyurtmaga havola", () => {
    renderWithProviders(<OrderParentBanner parentOrderId="95" />);
    const banner = screen.getByTestId("order-parent-banner");
    expect(banner).toHaveTextContent("Bu buyurtma #95 ning qisman sotuvidan qolgan qismi");
    expect(banner.querySelector("a")!.getAttribute("href")).toBe("/orders/edit/95");
  });

  it("yo'q bo'lsa — hech narsa", () => {
    const { container } = renderWithProviders(<OrderParentBanner parentOrderId={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
