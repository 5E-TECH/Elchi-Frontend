import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { theme as antdTheme, Card, Table } from "antd";
import AntdThemeProvider from "./AntdThemeProvider";
import { ThemeProvider } from "./ThemeContext";

/**
 * ANTD MAVZUSI ILOVA MAVZUSIGA BOG'LANGANMI.
 *
 * ⚠️ NIMA BUZILGAN EDI. Ilovada `ConfigProvider` UMUMAN yo'q edi, ya'ni
 * antd 55 ta faylda o'zining sukutdagi YORUG' temasida chizilardi. Sahifa
 * foni qorayardi (`.dark body`), antd kartalari esa OQ qolardi va ular
 * ichidagi Tailwind `dark:text-*` yozuvlari oq fonda oq bo'lib UMUMAN
 * ko'rinmasdi.
 *
 * ⚠️ NEGA TOKEN ORQALI TEKSHIRAMIZ. `dark:` Tailwind klasslari jsdom'da
 * hisoblanmaydi (CSS yuklanmaydi), lekin antd token'lari JS'da yashaydi —
 * ya'ni ularni to'g'ridan-to'g'ri o'qib, mavzu haqiqatan almashganini
 * isbotlash mumkin. Bu "klass bor" turidagi bo'sh tekshiruvdan kuchli.
 */

/** Token qiymatini o'qib DOM'ga chiqaradigan yordamchi. */
const TokenProbe = () => {
  const { token } = antdTheme.useToken();
  return (
    <span data-testid="probe" data-bg={token.colorBgContainer}>
      {token.colorPrimary}
    </span>
  );
};

const setTheme = (value: "dark" | "light") => {
  window.localStorage.clear();
  // ThemeProvider `readStoredTheme()` dan boshlang'ich qiymatni oladi.
  window.localStorage.setItem("theme", value);
};

/** `#rrggbb` yoki `rgb(...)` dan yorqinlik (0–255). */
const luminance = (color: string): number => {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    return ((n >> 16) + ((n >> 8) & 255) + (n & 255)) / 3;
  }
  const rgb = /rgba?\(([^)]+)\)/.exec(color);
  if (rgb) {
    const parts = rgb[1].split(",").map((v) => Number(v.trim()));
    return (parts[0] + parts[1] + parts[2]) / 3;
  }
  return NaN;
};

describe("AntdThemeProvider", () => {
  it("⭐ QORONG'I rejimda antd yuzasi QORA bo'ladi", () => {
    setTheme("dark");
    render(
      <ThemeProvider>
        <AntdThemeProvider>
          <TokenProbe />
        </AntdThemeProvider>
      </ThemeProvider>,
    );

    const bg = screen.getByTestId("probe").getAttribute("data-bg") ?? "";
    const value = luminance(bg);

    expect(Number.isNaN(value)).toBe(false);
    // Qorong'i yuza: o'rtacha kanal qiymati past bo'lishi kerak.
    expect(value).toBeLessThan(90);
  });

  it("⭐ YORUG' rejimda yuza OQ bo'lib qoladi", () => {
    /**
     * Teskari tekshiruv: mavzu almashishini isbotlaydi. Busiz test "har
     * doim qorong'i" holatida ham o'tardi va hech narsani isbotlamasdi.
     */
    setTheme("light");
    render(
      <ThemeProvider>
        <AntdThemeProvider>
          <TokenProbe />
        </AntdThemeProvider>
      </ThemeProvider>,
    );

    const bg = screen.getByTestId("probe").getAttribute("data-bg") ?? "";
    expect(luminance(bg)).toBeGreaterThan(200);
  });

  it("urg'u rangi sahifa INDIGO'si bilan bir xil", () => {
    /**
     * Aks holda antd tugmalari ko'k, sahifa chiplari esa indigo bo'lib,
     * bitta ekranda ikki xil "asosiy rang" paydo bo'lardi.
     *
     * ⚠️ YORUG' rejimda tekshiriladi. Qorong'ida antd urug' rangdan
     * boshqa soyani HISOBLAB chiqaradi (#6366f1 → #575ad0) — bu uning
     * ataylab qilgan ishi, shuning uchun u yerda aniq tenglik talab
     * qilish testni noto'g'ri yiqitardi.
     */
    setTheme("light");
    render(
      <ThemeProvider>
        <AntdThemeProvider>
          <TokenProbe />
        </AntdThemeProvider>
      </ThemeProvider>,
    );
    expect(screen.getByTestId("probe").textContent).toBe("#6366f1");
  });

  it("⭐ qorong'ida ham urg'u antd SUKUTIDAGI ko'k EMAS", () => {
    /**
     * Qorong'ida qiymat hisoblanadi, lekin u bizning urug'imizdan kelib
     * chiqishi kerak. Agar `ConfigProvider` tasodifan olib tashlansa,
     * antd sukutdagi ko'kka (#1677ff atrofi) qaytadi — test aynan shuni
     * ushlaydi.
     */
    setTheme("dark");
    render(
      <ThemeProvider>
        <AntdThemeProvider>
          <TokenProbe />
        </AntdThemeProvider>
      </ThemeProvider>,
    );

    const color = screen.getByTestId("probe").textContent ?? "";
    const n = parseInt(color.replace("#", ""), 16);
    const r = (n >> 16) & 255;
    const b = n & 255;
    // Indigo'da qizil kanal sezilarli (≈87), antd ko'kida esa juda past (≈22).
    expect(r).toBeGreaterThan(50);
    expect(b).toBeGreaterThan(r);
  });

  it("⭐ haqiqiy antd komponentlari ham qorong'i yuzada chiziladi", () => {
    /**
     * Token to'g'ri bo'lsa ham komponent uni ishlatmasligi mumkin edi
     * (masalan `Card` o'z fonini qattiq kodlagan bo'lsa). Shu bois
     * komponentning HAQIQIY inline stilini tekshiramiz.
     */
    setTheme("dark");
    const { container } = render(
      <ThemeProvider>
        <AntdThemeProvider>
          <Card title="Ulanish">
            <Table dataSource={[]} columns={[{ title: "Nom", key: "n" }]} />
          </Card>
        </AntdThemeProvider>
      </ThemeProvider>,
    );

    // antd v6 CSS-in-JS uslublarni `<style>` ichiga chiqaradi.
    const styles = Array.from(container.ownerDocument.querySelectorAll("style"))
      .map((s) => s.textContent ?? "")
      .join("\n");

    expect(styles.length).toBeGreaterThan(0);
    // Oq karta foni (`#fff`/`#ffffff`) qorong'i rejimda bo'lmasligi kerak.
    const cardBg = /\.ant-card\s*\{[^}]*background[^;]*;/.exec(styles)?.[0] ?? "";
    expect(cardBg.toLowerCase()).not.toMatch(/#fff\b|#ffffff/);
  });
});
