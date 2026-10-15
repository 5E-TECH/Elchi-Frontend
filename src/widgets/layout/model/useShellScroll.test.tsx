import { act, render } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider, useNavigate } from "react-router-dom";
import { __clearSavedScrollPositions, useShellScroll } from "./useShellScroll";

/**
 * Shell skrolli: yo'l o'zgarsa `<main>` tepaga, faqat `?search` o'zgarsa joyida,
 * «Orqaga» (POP) — shu yozuvning oldingi joyi tiklanadi.
 *
 * jsdom layout hisoblamaydi — `<main>` ning skroll balandligi qo'lda beriladi.
 */
let navigateRef: ReturnType<typeof useNavigate> | null = null;
let mainEl: HTMLElement | null = null;

const Shell = () => {
  const ref = useRef<HTMLElement>(null);
  useShellScroll(ref);
  const navigate = useNavigate();
  useEffect(() => {
    navigateRef = navigate;
  }, [navigate]);
  return (
    <main
      ref={(node) => {
        ref.current = node;
        mainEl = node;
        if (node) {
          Object.defineProperty(node, "scrollHeight", { configurable: true, value: 5000 });
          Object.defineProperty(node, "clientHeight", { configurable: true, value: 800 });
        }
      }}
    />
  );
};

const renderShell = (initial = "/orders") => {
  const router = createMemoryRouter([{ path: "*", element: <Shell /> }], { initialEntries: [initial] });
  render(<RouterProvider router={router} />);
  return router;
};

/** Foydalanuvchi aylantirdi: joy + `scroll` hodisasi (joy yozib boriladi). */
const scrollTo = (top: number) => {
  act(() => {
    mainEl!.scrollTop = top;
    mainEl!.dispatchEvent(new Event("scroll"));
  });
};
const go = async (to: string | number) => {
  await act(async () => {
    if (typeof to === "number") await navigateRef!(to);
    else await navigateRef!(to);
  });
};

afterEach(() => {
  __clearSavedScrollPositions();
  navigateRef = null;
  mainEl = null;
});

describe("useShellScroll", () => {
  it("⭐ yo'l o'zgarsa (PUSH) — <main> tepaga qaytadi", async () => {
    renderShell("/orders");
    scrollTo(1200);
    await go("/mails");
    expect(mainEl!.scrollTop).toBe(0);
  });

  it("⭐ faqat ?search o'zgarsa (tab/filtr) — skroll joyida qoladi", async () => {
    renderShell("/orders?status=new");
    scrollTo(900);
    await go("/orders?status=sold");
    expect(mainEl!.scrollTop).toBe(900);
  });

  it("REPLACE bilan boshqa yo'lga — tepaga", async () => {
    renderShell("/orders");
    scrollTo(700);
    await act(async () => {
      await navigateRef!("/batches", { replace: true });
    });
    expect(mainEl!.scrollTop).toBe(0);
  });

  it("⭐ «Orqaga» (POP) — oldingi sahifaning skroll joyi tiklanadi, «Oldinga» — keyingisiniki", async () => {
    renderShell("/orders");
    scrollTo(1500);
    await go("/orders/42");
    expect(mainEl!.scrollTop).toBe(0);
    scrollTo(300);

    await go(-1);
    expect(mainEl!.scrollTop).toBe(1500);

    await go(1);
    expect(mainEl!.scrollTop).toBe(300);
  });

  it("joyi saqlanmagan yozuvga POP — tepaga", async () => {
    const router = renderShell("/orders");
    await go("/mails");
    // /orders da hech aylantirilmagan — saqlangan joy yo'q.
    scrollTo(0);
    await act(async () => {
      await router.navigate(-1);
    });
    expect(mainEl!.scrollTop).toBe(0);
  });
});
