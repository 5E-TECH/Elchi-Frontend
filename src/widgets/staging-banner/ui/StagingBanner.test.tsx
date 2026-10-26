import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import i18n, { i18nReady } from "../../../i18n";
import { isStagingEnv, mountStagingBanner, STAGING_LOCALES, STAGING_TITLE_PREFIX } from "..";

/**
 * «TEST MUHIT» BELGISI — faqat `VITE_APP_ENV=staging` (test-admin.elchipochta.uz). Production build'da chunk umuman
 * yo'q (`src/main.tsx` sharti build vaqtida `false`); bu yerda `mountStagingBanner` ning o'z sharti, ko'rinishi,
 * tillari va sarlavha prefiksi tekshiriladi.
 */
let unmount: (() => void) | null = null;

const mount = async (env: unknown) => {
  await act(async () => {
    unmount = mountStagingBanner(env);
    await i18nReady;
  });
};

afterEach(async () => {
  await act(async () => {
    unmount?.();
  });
  unmount = null;
  document.title = "";
  await i18n.changeLanguage("uz");
});

describe("TEST muhit belgisi — shart", () => {
  it("faqat «staging» qiymatida", () => {
    expect(isStagingEnv("staging")).toBe(true);
    for (const value of ["production", "development", "test", "", undefined, null, "Staging"]) {
      expect(isStagingEnv(value), String(value)).toBe(false);
    }
  });

  it.each([["production"], [undefined], ["development"]])("%s — hech narsa chizilmaydi, sarlavha tegilmaydi", async (env) => {
    document.title = "Elchi Pochta";
    await mount(env);
    expect(unmount).toBeNull();
    expect(document.querySelector("[data-staging-root]")).toBeNull();
    expect(document.querySelector("[data-staging-banner]")).toBeNull();
    expect(screen.queryByText(STAGING_LOCALES.uz.label)).toBeNull();
    expect(document.title).toBe("Elchi Pochta");
  });
});

describe("TEST muhit belgisi — staging", () => {
  it("«TEST muhit» yorlig'i: tepada, bosishni to'smaydi (pointer-events-none), toast qatlamida, izoh bilan", async () => {
    await mount("staging");
    const label = await screen.findByText("TEST muhit");
    const banner = label.closest("[data-staging-banner]");
    expect(banner).not.toBeNull();
    expect(banner).toHaveAttribute("role", "note");
    expect(banner).toHaveAccessibleName(STAGING_LOCALES.uz.description);
    expect(banner?.className).toMatch(/\bpointer-events-none\b/);
    expect(banner?.className).toMatch(/\bfixed\b/);
    expect(banner?.className).toMatch(/\btop-0\b/);
    expect(banner?.parentElement).toHaveAttribute("data-ui-layer", "toast");
    // Ranglar faqat tokenlardan (ogohlantirish toni, ikkala mavzuda bir xil klass).
    expect(label.className).toContain("bg-warning text-on-solid");
  });

  it("uz / ru / en — til almashsa matn o'zi yangilanadi", async () => {
    await mount("staging");
    expect(await screen.findByText("TEST muhit")).toBeInTheDocument();
    await act(async () => {
      await i18n.changeLanguage("ru");
    });
    expect(await screen.findByText("ТЕСТ-среда")).toBeInTheDocument();
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    expect(await screen.findByText("TEST environment")).toBeInTheDocument();
  });

  it("hujjat sarlavhasi doim «[TEST] …» — sahifa nomi keyin yozilsa ham", async () => {
    document.title = "Elchi Pochta — Logistika va Kuryer Xizmati";
    await mount("staging");
    expect(document.title).toBe(`${STAGING_TITLE_PREFIX}Elchi Pochta — Logistika va Kuryer Xizmati`);
    document.title = "Buyurtmalar — Elchi Pochta";
    await waitFor(() => expect(document.title).toBe("[TEST] Buyurtmalar — Elchi Pochta"));
  });

  it("olib tashlansa — belgi va ildiz yo'qoladi", async () => {
    await mount("staging");
    await screen.findByText("TEST muhit");
    await act(async () => {
      unmount?.();
    });
    unmount = null;
    expect(document.querySelector("[data-staging-root]")).toBeNull();
    expect(screen.queryByText("TEST muhit")).toBeNull();
  });

  it("uz / ru / en matnlari to'liq (bir xil kalitlar, bo'sh emas)", () => {
    const keys = Object.keys(STAGING_LOCALES.uz).sort();
    for (const [language, bundle] of Object.entries(STAGING_LOCALES)) {
      expect(Object.keys(bundle).sort(), language).toEqual(keys);
      for (const value of Object.values(bundle)) expect(value.trim().length, language).toBeGreaterThan(0);
    }
  });
});
