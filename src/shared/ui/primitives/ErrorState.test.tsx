import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { getErrorKind } from "../../lib/errorKind";
import { ErrorState } from "./ErrorState";

/** ErrorState — `tizim-errors` 02 (ma'lumot yuklanmadi · internet yo'q · ruxsat yo'q · bo'lim xatosi), CODE-MAP 2.7. */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

afterEach(() => {
  vi.restoreAllMocks();
});

const axiosError = (status?: number, extra: Record<string, unknown> = {}) => ({
  isAxiosError: true,
  request: {},
  ...(status ? { response: { status, data: extra.data } } : {}),
  ...extra,
});

describe("getErrorKind", () => {
  it.each([
    [axiosError(500), "server"],
    [axiosError(503), "server"],
    [axiosError(403), "forbidden"],
    [axiosError(422), "generic"],
    [axiosError(undefined, { code: "ERR_NETWORK" }), "offline"],
    [axiosError(undefined, { code: "ECONNABORTED" }), "timeout"],
    [{ status: 500 }, "server"],
    [new Error("boom"), "generic"],
    [undefined, "generic"],
  ])("%j → %s", (error, kind) => {
    expect(getErrorKind(error)).toBe(kind);
  });

  it("brauzer oflayn bo'lsa — offline", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(getErrorKind(axiosError(500))).toBe("offline");
  });
});

describe("ErrorState", () => {
  it("server (500): danger ikonka, sarlavha, holat kodi bilan sabab, «Qayta urinish» secondary, role=alert", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(<ErrorState error={axiosError(500)} onRetry={retry} />);
    const root = screen.getByRole("alert");
    expect(root).toHaveAttribute("data-error-kind", "server");
    expect(root.querySelector("[data-state-icon]")).toHaveClass("bg-danger-soft", "text-danger-fg");
    expect(root.querySelector("svg.lucide-server-crash")).not.toBeNull();
    expect(screen.getByText("Ma'lumotni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText("Server xatosi (500). Birozdan keyin qayta urinib ko'ring.")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Qayta urinish" });
    expect(button).toHaveAttribute("data-variant", "secondary");
    await user.click(button);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("internet yo'q: WifiOff, «Internet aloqasi yo'q»", () => {
    render(<ErrorState error={axiosError(undefined, { code: "ERR_NETWORK" })} onRetry={() => {}} />);
    expect(screen.getByText("Internet aloqasi yo'q")).toBeInTheDocument();
    expect(screen.getByText("Internetga ulanishni tekshiring va qayta urinib ko'ring.")).toBeInTheDocument();
    expect(screen.getByRole("alert").querySelector("svg.lucide-wifi-off")).not.toBeNull();
  });

  it("403: kulrang qulf, role=status, «Qayta urinish» yo'q", () => {
    render(<ErrorState error={axiosError(403)} onRetry={() => {}} />);
    const root = screen.getByRole("status");
    expect(root.querySelector("[data-state-icon]")).toHaveClass("bg-sunken", "text-text-muted");
    expect(screen.getByText("Bu ma'lumotni ko'rishga ruxsatingiz yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("generic: backend xabari; holat kodi; bo'lim xatosi qo'lda", () => {
    const { rerender } = render(<ErrorState error={axiosError(422, { data: { message: "Telefon noto'g'ri" } })} />);
    expect(screen.getByText("Telefon noto'g'ri")).toBeInTheDocument();
    rerender(<ErrorState error={axiosError(404)} />);
    expect(screen.getByText("So'rov bajarilmadi (404).")).toBeInTheDocument();
    rerender(<ErrorState kind="section" />);
    expect(screen.getByText("Bu bo'limni ochishda xatolik yuz berdi")).toBeInTheDocument();
    expect(screen.getByText("Boshqa bo'limlar ishlashda davom etadi.")).toBeInTheDocument();
  });

  it("sahifa: «Qayta urinish» asosiy + qo'shimcha amal; tafsilotlar ochiladi (aria-expanded)", async () => {
    const user = userEvent.setup();
    render(
      <ErrorState
        size="page"
        kind="generic"
        title="Sahifani ko'rsatib bo'lmadi"
        onRetry={() => {}}
        actions={<button type="button">Bosh sahifaga qaytish</button>}
        details="TypeError: x is undefined"
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Sahifani ko'rsatib bo'lmadi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toHaveAttribute("data-variant", "primary");
    expect(screen.getByRole("button", { name: "Bosh sahifaga qaytish" })).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Xato tafsilotlari" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const details = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
    expect(details).not.toBeVisible();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(details).toBeVisible();
    expect(details).toHaveTextContent("TypeError: x is undefined");
  });

  it("qayta urinish ketmoqda — tugmada yuklanish (aria-busy)", () => {
    render(<ErrorState error={axiosError(500)} onRetry={() => {}} retrying />);
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toHaveAttribute("aria-busy", "true");
  });

  it("ru: matnlar tarjima qilingan", async () => {
    await i18n.changeLanguage("ru");
    try {
      render(<ErrorState error={axiosError(500)} onRetry={() => {}} />);
      expect(screen.getByText("Не удалось загрузить данные")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage("uz");
    }
  });
});
