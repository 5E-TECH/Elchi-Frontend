import { Suspense } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * rzzxMItN — to'g'ridan-to'g'ri `/login`: modul chizishdan oldin kelgan bo'lsa (`main.tsx` → `preloadLoginPage`),
 * birinchi chizishda forma — Suspense «Ilova yuklanmoqda» ekrani chaqnamaydi. Aks holda oddiy `lazy`.
 */
vi.mock("../../features/auth", () => ({ default: () => <p>Kirish formasi</p> }));

const renderPage = async () => {
  const { default: LoginPage } = await import("./loginPage");
  render(
    <Suspense fallback={<p>Ilova yuklanmoqda</p>}>
      <LoginPage />
    </Suspense>,
  );
};

describe("LoginPage — oldindan yuklash", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("modul oldindan kelgan — birinchi chizishda forma, zaxira ekranisiz", async () => {
    const { preloadLoginPage } = await import("./loginPagePreload");
    await preloadLoginPage();
    await renderPage();

    expect(screen.getByText("Kirish formasi")).toBeInTheDocument();
    expect(screen.queryByText("Ilova yuklanmoqda")).toBeNull();
  });

  it("oldindan yuklanmagan — oddiy lazy: avval zaxira, keyin forma", async () => {
    await renderPage();

    expect(screen.getByText("Ilova yuklanmoqda")).toBeInTheDocument();
    expect(await screen.findByText("Kirish formasi")).toBeInTheDocument();
  });
});
