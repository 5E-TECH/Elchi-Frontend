import { act, fireEvent, render, screen } from "@testing-library/react";
import { lazy, Suspense, useLayoutEffect, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BrowserRouter, Link, MemoryRouter, Route, Routes } from "react-router-dom";
import {
  __resetNavigationPendingForTests,
  beginRouteSuspense,
  useNavPathname,
  useRouteTransition,
} from "./navigationPending";

/**
 * Bo'limlar orasida o'tish holati: router transition'i kutilayotganda (lazy chunk)
 * eski sahifa ko'rinib turadi — shu payt holat «yuklanmoqda» va menyu uchun yo'l
 * DARHOL yangi manzil bo'lishi kerak.
 */
const Probe = () => {
  const { isLoading, pendingPathname } = useRouteTransition();
  const navPath = useNavPathname();
  return (
    <output data-testid="probe">
      {JSON.stringify({ isLoading, pendingPathname, navPath })}
    </output>
  );
};
const probe = () => JSON.parse(screen.getByTestId("probe").textContent ?? "{}");

/** Testning o'zi boshqaradigan lazy sahifa: `resolve()` chaqirilguncha chunk «yuklanmoqda». */
const deferredPage = (text: string) => {
  let resolve!: () => void;
  const promise = new Promise<{ default: () => ReactElement }>((done) => {
    resolve = () => done({ default: () => <p>{text}</p> });
  });
  return { Page: lazy(() => promise), resolve };
};

const flushTimers = () => act(() => new Promise((done) => window.setTimeout(done, 0)));

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  __resetNavigationPendingForTests();
});
afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("useRouteTransition / useNavPathname", () => {
  it("⭐ havola bosilgach chunk kutilayotganda: yuklanmoqda, menyu yo'li — yangi manzil; kelgach tozalanadi", async () => {
    const orders = deferredPage("Buyurtmalar sahifasi");
    render(
      <BrowserRouter>
        <Probe />
        <Link to="/orders">Buyurtmalar</Link>
        <Suspense fallback={<p>fallback</p>}>
          <Routes>
            <Route path="/" element={<p>Bosh sahifa</p>} />
            <Route path="/orders" element={<orders.Page />} />
          </Routes>
        </Suspense>
      </BrowserRouter>,
    );
    expect(probe()).toEqual({ isLoading: false, pendingPathname: null, navPath: "/" });

    fireEvent.click(screen.getByRole("link", { name: "Buyurtmalar" }));
    await flushTimers();

    // Transition: eski sahifa joyida, fallback chiqmaydi — lekin holat «kutilmoqda».
    expect(screen.getByText("Bosh sahifa")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/orders");
    expect(probe()).toEqual({ isLoading: true, pendingPathname: "/orders", navPath: "/orders" });

    await act(async () => {
      orders.resolve();
    });
    expect(await screen.findByText("Buyurtmalar sahifasi")).toBeInTheDocument();
    expect(probe()).toEqual({ isLoading: false, pendingPathname: null, navPath: "/orders" });
  });

  it("«Orqaga»/«Oldinga» (popstate) ham kutish sifatida seziladi", async () => {
    const returns = deferredPage("Qaytarishlar sahifasi");
    render(
      <BrowserRouter>
        <Probe />
        <Suspense fallback={<p>fallback</p>}>
          <Routes>
            <Route path="/" element={<p>Bosh sahifa</p>} />
            <Route path="/returns" element={<returns.Page />} />
          </Routes>
        </Suspense>
      </BrowserRouter>,
    );
    // Tarixdagi yozuvga qaytish: URL o'zgaradi va `popstate` keladi (router ham shuni tinglaydi).
    act(() => {
      window.history.pushState(null, "", "/returns");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByText("Bosh sahifa")).toBeInTheDocument();
    expect(probe()).toEqual({ isLoading: true, pendingPathname: "/returns", navPath: "/returns" });

    await act(async () => {
      returns.resolve();
    });
    expect(await screen.findByText("Qaytarishlar sahifasi")).toBeInTheDocument();
    expect(probe()).toEqual({ isLoading: false, pendingPathname: null, navPath: "/returns" });
  });

  it("MemoryRouter (window.location o'zgarmaydi) — hech qachon «kutilmoqda» emas", async () => {
    render(
      <MemoryRouter initialEntries={["/orders"]}>
        <Probe />
        <Link to="/mails">Pochta</Link>
        <Routes>
          <Route path="*" element={<p>sahifa</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(probe()).toEqual({ isLoading: false, pendingPathname: null, navPath: "/orders" });
    fireEvent.click(screen.getByRole("link", { name: "Pochta" }));
    await flushTimers();
    expect(probe()).toEqual({ isLoading: false, pendingPathname: null, navPath: "/mails" });
  });

  it("shell Suspense fallback'i ko'ringan payt — yuklanmoqda; yo'qolgach — yo'q", () => {
    const Fallback = () => {
      useLayoutEffect(() => beginRouteSuspense(), []);
      return null;
    };
    const { rerender } = render(
      <MemoryRouter>
        <Probe />
        <Fallback />
      </MemoryRouter>,
    );
    expect(probe().isLoading).toBe(true);
    rerender(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>,
    );
    expect(probe().isLoading).toBe(false);
  });

  it("qaytgan tugatuvchi ikki marta chaqirilsa ham sanoq manfiy bo'lmaydi", () => {
    const end = beginRouteSuspense();
    end();
    end();
    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>,
    );
    expect(probe().isLoading).toBe(false);
  });
});
