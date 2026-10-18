import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import { loginSuccess, logout } from "../../entities/user/model/slice";
import { queryKeys } from "../../shared/config/queryKeys";
import { BASE_URL } from "../../shared/const";
import {
  isRealtimeConnected,
  OFFLINE_POLL_MS,
  REALTIME_FALLBACK_POLL_MS,
  realtimeUrl,
  setRealtimeConnected,
  unreadCountPollInterval,
} from "../../shared/lib/realtime";
import RealtimeSync from "./RealtimeSync";

type Handler = (...args: unknown[]) => void;

/** socket.io-client o'rnida — hodisalarni testdan yuborish uchun. */
const socketMock = vi.hoisted(() => {
  const createSocket = (url: string, options: { auth?: { token?: string } }) => {
    const handlers = new Map<string, Handler[]>();
    const managerHandlers = new Map<string, Handler[]>();
    const socket = {
      url,
      options,
      active: true,
      on: (event: string, handler: Handler) => {
        handlers.set(event, [...(handlers.get(event) ?? []), handler]);
        return socket;
      },
      fire: (event: string, ...args: unknown[]) => handlers.get(event)?.forEach((handler) => handler(...args)),
      removeAllListeners: () => handlers.clear(),
      disconnect: () => {
        socket.disconnected = true;
      },
      disconnected: false,
      io: {
        on: (event: string, handler: Handler) => managerHandlers.set(event, [...(managerHandlers.get(event) ?? []), handler]),
        off: (event: string) => managerHandlers.delete(event),
        fire: (event: string) => managerHandlers.get(event)?.forEach((handler) => handler()),
      },
    };
    return socket;
  };
  const state = { sockets: [] as ReturnType<typeof createSocket>[] };
  const io = (url: string, options: { auth?: { token?: string } }) => {
    const socket = createSocket(url, options);
    state.sockets.push(socket);
    return socket;
  };
  return { state, io };
});

vi.mock("socket.io-client", () => ({ io: socketMock.io }));

const authState = (token: string | null) => ({
  user: {
    user: null,
    isAuthenticated: Boolean(token),
    accessToken: token,
    loading: false,
    isAppInitializing: false,
    error: null,
  },
});

let visibility: DocumentVisibilityState = "visible";

const renderSync = (token: string | null = "tok-1") =>
  renderWithProviders(
    <>
      <RealtimeSync />
      <Routes>
        <Route path="/orders/:id" element={<div>buyurtma-sahifasi</div>} />
        <Route path="/inbox" element={<div>inbox-sahifasi</div>} />
        <Route path="*" element={null} />
      </Routes>
    </>,
    { preloadedState: authState(token) as never },
  );

const lastSocket = () => socketMock.state.sockets.at(-1)!;

describe("RealtimeSync — jonli bildirishnomalar (uRkw6lk0)", () => {
  beforeEach(() => {
    socketMock.state.sockets.length = 0;
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  });

  afterEach(() => {
    setRealtimeConnected(false);
  });

  it("⭐ TC1: kirgan foydalanuvchi `/realtime` namespace'ga access token bilan ulanadi", async () => {
    renderSync("tok-1");

    await waitFor(() => expect(socketMock.state.sockets).toHaveLength(1));
    expect(lastSocket().url).toBe(realtimeUrl(BASE_URL));
    expect(lastSocket().url.endsWith("/realtime")).toBe(true);
    expect(lastSocket().options.auth).toEqual({ token: "tok-1" });
  });

  it("kirmagan foydalanuvchi — ulanish yo'q", async () => {
    renderSync(null);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(socketMock.state.sockets).toHaveLength(0);
  });

  it("⭐ TC2/TC3: `notification:new` — badge va ro'yxat yangilanadi, «sarlavha + kategoriya · matn» xabari, «Ochish» havolaga olib boradi", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderSync();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await waitFor(() => expect(socketMock.state.sockets).toHaveLength(1));

    act(() =>
      lastSocket().fire("notification:new", {
        id: "n-77",
        title: "Buyurtma sotildi",
        body: "№10225 · Baraka Shop",
        category: "order",
        link: "/orders/10225",
      }),
    );

    expect(await screen.findByText("Buyurtma sotildi")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.notificationsInbox.all });
    expect(screen.getByText("Buyurtma · №10225 · Baraka Shop")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ochish" }));
    expect(await screen.findByText("buyurtma-sahifasi")).toBeInTheDocument();
  });

  it("bir vaqtda ko'p xabar (ketma-ket holatlar) — bitta yangilash so'rovi va bitta «N ta yangi bildirishnoma»", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderSync();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await waitFor(() => expect(socketMock.state.sockets).toHaveLength(1));
    invalidate.mockClear();

    act(() => {
      for (let n = 1; n <= 5; n += 1) {
        lastSocket().fire("notification:new", { id: `b-${n}`, title: `Holat ${n}`, category: "order", link: "/orders/1" });
      }
    });

    expect(await screen.findByText("5 ta yangi bildirishnoma")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Holat 1")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ochish" }));
    expect(await screen.findByText("inbox-sahifasi")).toBeInTheDocument();
  });

  it("⭐ TC7: bitta hodisa ikki marta kelsa (socket + push / qayta yuborish) — xabar bitta", async () => {
    renderSync();
    await waitFor(() => expect(socketMock.state.sockets).toHaveLength(1));
    const payload = { id: "n-1", title: "Kassa topshirildi", category: "finance", link: "/cash-box" };

    act(() => {
      lastSocket().fire("notification:new", payload);
      lastSocket().fire("notification:new", payload);
    });

    expect(await screen.findAllByText("Kassa topshirildi")).toHaveLength(1);
  });

  it("rol/broadcast signali (`id` siz) — faqat yangilanadi, xabar chiqmaydi; yashirin tabda ham xabar yo'q", async () => {
    const { queryClient } = renderSync();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await waitFor(() => expect(socketMock.state.sockets).toHaveLength(1));

    act(() => lastSocket().fire("notification:new", { type: "system.announcement", category: "system", priority: "normal" }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.notificationsInbox.all }));
    expect(screen.queryByRole("region", { name: "Bildirishnomalar" })).not.toBeInTheDocument();

    visibility = "hidden";
    act(() => lastSocket().fire("notification:new", { id: "n-9", title: "Yashirin tab", category: "system" }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText("Yashirin tab")).not.toBeInTheDocument();
  });

  it("⭐ TC4/TC11: ulanganda polling 5 daqiqa; uzilsa sanoq darhol so'raladi va 60 s ga qaytadi; qayta ulanganda inbox yangilanadi", async () => {
    const { queryClient } = renderSync();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await waitFor(() => expect(socketMock.state.sockets).toHaveLength(1));

    act(() => lastSocket().fire("connect"));
    expect(isRealtimeConnected()).toBe(true);
    expect(unreadCountPollInterval()).toBe(REALTIME_FALLBACK_POLL_MS);
    // Har ulanishda (birinchi ham) — ulanmagan oraliqdagi xabarlar uchun inbox yangilanadi.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.notificationsInbox.all });

    act(() => lastSocket().fire("disconnect", "transport close"));
    expect(isRealtimeConnected()).toBe(false);
    expect(unreadCountPollInterval()).toBe(OFFLINE_POLL_MS);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.notificationsInbox.unreadCount });

    invalidate.mockClear();
    act(() => lastSocket().fire("connect"));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.notificationsInbox.all });
  });

  it("⭐ TC5: logout — socket uziladi va qayta ulanishga urinmaydi", async () => {
    const { store } = renderSync();
    await waitFor(() => expect(socketMock.state.sockets).toHaveLength(1));
    act(() => lastSocket().fire("connect"));

    act(() => {
      store.dispatch(logout());
    });

    expect(lastSocket().disconnected).toBe(true);
    expect(isRealtimeConnected()).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(socketMock.state.sockets).toHaveLength(1);
  });

  it("access token yangilansa — eski ulanish yopiladi, yangi token bilan qayta ulanadi", async () => {
    const { store } = renderSync("tok-1");
    await waitFor(() => expect(socketMock.state.sockets).toHaveLength(1));
    const first = lastSocket();

    act(() => {
      store.dispatch(loginSuccess({ accessToken: "tok-2" }));
    });

    await waitFor(() => expect(socketMock.state.sockets).toHaveLength(2));
    expect(first.disconnected).toBe(true);
    expect(lastSocket().options.auth).toEqual({ token: "tok-2" });
  });

  it("⭐ TC6: server tokenni rad etsa (`connect_error`, `active=false`) — yangi ulanish yaratilmaydi", async () => {
    renderSync("eskirgan");
    await waitFor(() => expect(socketMock.state.sockets).toHaveLength(1));

    act(() => {
      lastSocket().active = false;
      lastSocket().fire("connect_error", new Error("Unauthorized"));
    });

    expect(isRealtimeConnected()).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(socketMock.state.sockets).toHaveLength(1);
  });
});
