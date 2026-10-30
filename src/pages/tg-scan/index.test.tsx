import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import { tgScanHttp } from "../../features/tg-scan/api/tgScanApi";
import TgScanPage from "./index";

type CameraOptions = { isActive: boolean; onDecode: (value: string) => void };

const camera = vi.hoisted(() => {
  const idle = {
    isStarting: false,
    torchEnabled: false,
    hasTorch: false,
    cameraError: "",
    cameraUnavailable: false,
  };
  return {
    idle,
    calls: [] as CameraOptions[],
    result: { ...idle },
  };
});

vi.mock("../../shared/lib/useCameraQrScanner", () => ({
  useCameraQrScanner: (options: CameraOptions) => {
    camera.calls.push(options);
    return {
      ...camera.result,
      stopScanner: () => undefined,
      restartScanner: () => undefined,
      toggleTorch: async () => undefined,
      setCameraError: () => undefined,
    };
  },
}));

const latestCamera = () => camera.calls.at(-1);

// ── dedicated HTTP client: real axios pipeline, fake transport ───────────────
type Handler = (config: InternalAxiosRequestConfig) => unknown;
let routes: Record<string, Handler> = {};
let requests: InternalAxiosRequestConfig[] = [];
const originalAdapter = tgScanHttp.defaults.adapter;

const adapter: AxiosAdapter = async (config) => {
  requests.push(config);
  const handler = routes[config.url ?? ""];
  if (!handler) throw new Error(`unexpected request ${config.url}`);
  const data = await handler(config);
  return { data, status: 200, statusText: "OK", headers: {}, config } as AxiosResponse;
};

const httpError = (config: InternalAxiosRequestConfig, status: number, message: string) =>
  new AxiosError(message, "ERR_BAD_REQUEST", config, {}, {
    data: { statusCode: status, message },
    status,
    statusText: "",
    headers: {},
    config,
  } as AxiosResponse);

const bodyOf = (config: InternalAxiosRequestConfig) => JSON.parse(String(config.data)) as Record<string, unknown>;
const requestsTo = (url: string) => requests.filter((request) => request.url === url);
const header = (config: InternalAxiosRequestConfig, name: string) => config.headers.get(name);

const AUTH_OK = {
  statusCode: 200,
  message: "success",
  user: { id: "25", name: "Test Kuryer", role: "courier" },
  accessToken: "tg.jwt.token",
  access_token_expires_at: 1_900_000_000_000,
};

const ORDER_53 = {
  id: "53",
  order_number: "10191",
  status: "on_the_road",
  total_price: 310000,
  address: "Amir Temur 1",
  district: "Yunusobod tumani",
  region: "Toshkent sh.",
  market: "TEST market",
  customer: { name: "Lobar Yusupova", phone_number: "+998901234567" },
};

const ORDER_54 = {
  ...ORDER_53,
  id: "54",
  order_number: "10192",
  district: "Chilonzor tumani",
  customer: { name: "Sardor Qodirov", phone_number: "+998907654321" },
};

const assigned = (order: typeof ORDER_53, idempotent = false) => ({
  statusCode: 200,
  message: idempotent ? "Order already assigned to this courier" : "Order courierga biriktirildi",
  data: { idempotent, order_id: order.id, post_id: "9", post_created: false, order },
});

// ── fake Telegram WebApp ─────────────────────────────────────────────────────
const makeWebApp = (overrides: Record<string, unknown> = {}) => ({
  initData: "query_id=AAH&user=%7B%22id%22%3A123%7D&auth_date=1760000000&hash=abc",
  version: "8.0",
  ready: vi.fn(),
  expand: vi.fn(),
  close: vi.fn(),
  isVersionAtLeast: (version: string) => Number.parseFloat(version) <= 8,
  HapticFeedback: { impactOccurred: vi.fn(), notificationOccurred: vi.fn(), selectionChanged: vi.fn() },
  showScanQrPopup: vi.fn(),
  closeScanQrPopup: vi.fn(),
  disableVerticalSwipes: vi.fn(),
  setHeaderColor: vi.fn(),
  setBackgroundColor: vi.fn(),
  ...overrides,
});

type FakeWebApp = ReturnType<typeof makeWebApp>;
const setWebApp = (webApp: FakeWebApp | null) => {
  (window as unknown as { Telegram?: unknown }).Telegram = webApp ? { WebApp: webApp } : undefined;
};

// Skan pauzasi (700 ms / takror 1800 ms) `Date.now` ga qaraydi — har skandan oldin soat oldinga suriladi.
let now = 1_760_000_000_000;
const decode = async (value: string) => {
  now += 5_000;
  await act(async () => {
    latestCamera()?.onDecode(value);
  });
};

const renderReady = async (webApp = makeWebApp()) => {
  routes["auth/telegram"] = () => AUTH_OK;
  setWebApp(webApp);
  renderWithProviders(<TgScanPage />, { route: "/tg/scan" });
  await waitFor(() => expect(latestCamera()?.isActive).toBe(true));
  return webApp;
};

beforeEach(() => {
  routes = {};
  requests = [];
  camera.calls.length = 0;
  camera.result = { ...camera.idle };
  tgScanHttp.defaults.adapter = adapter;
  vi.spyOn(Date, "now").mockImplementation(() => now);
});

afterEach(() => {
  tgScanHttp.defaults.adapter = originalAdapter;
  setWebApp(null);
  vi.restoreAllMocks();
});

describe("/tg/scan — Telegram skan Mini App", () => {
  it("outside Telegram (empty initData) shows the Telegram-only state and never starts the camera", async () => {
    setWebApp(makeWebApp({ initData: "" }));
    renderWithProviders(<TgScanPage />, { route: "/tg/scan" });

    expect(await screen.findByText("Bu sahifa faqat Telegram ichida ochiladi")).toBeInTheDocument();
    expect(camera.calls.some((call) => call.isActive)).toBe(false);
    expect(requests).toHaveLength(0);
  });

  it("signs in with the raw initData (no session token) and starts the scanner", async () => {
    const webApp = await renderReady();

    const [auth] = requestsTo("auth/telegram");
    expect(bodyOf(auth)).toEqual({ init_data: webApp.initData });
    expect(header(auth, "Authorization")).toBeFalsy();
    expect(webApp.ready).toHaveBeenCalled();
    expect(webApp.expand).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "QR skaner" })).toBeInTheDocument();
    expect(screen.getByTestId("tg-scan-count")).toHaveTextContent("0");
  });

  it("shows the backend reason when Telegram sign-in is rejected and keeps the camera off", async () => {
    const message = "Telegram akkaunt Elchi'ga bog'lanmagan — avval kabinetdan «Telegram'ni ulash» ni bosing";
    routes["auth/telegram"] = (config) => {
      throw httpError(config, 401, message);
    };
    setWebApp(makeWebApp());
    renderWithProviders(<TgScanPage />, { route: "/tg/scan" });

    expect(await screen.findByText("Kirib bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(camera.calls).toHaveLength(0);
  });

  it("BOT-2: 403 TELEGRAM_COURIER_ONLY on sign-in shows the courier-only state and keeps the camera off", async () => {
    routes["auth/telegram"] = (config) => {
      const error = httpError(config, 403, "Forbidden");
      (error.response!.data as Record<string, unknown>).code = "TELEGRAM_COURIER_ONLY";
      throw error;
    };
    const webApp = makeWebApp();
    setWebApp(webApp);
    renderWithProviders(<TgScanPage />, { route: "/tg/scan" });

    expect(await screen.findByText("Skaner faqat kuryerlar uchun")).toBeInTheDocument();
    expect(screen.queryByText("Kirib bo'lmadi")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qayta urinish" })).not.toBeInTheDocument();
    expect(camera.calls).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Yopish" }));
    expect(webApp.close).toHaveBeenCalled();
  });

  it("a decode assigns the order with the Mini App JWT, bumps the counter and shows district + customer", async () => {
    const webApp = await renderReady();
    routes["orders/scan-assign"] = () => assigned(ORDER_53);

    await decode("https://admin.elchipochta.uz/scan/ORD-abc");

    expect(await screen.findByText("№10191 qabul qilindi")).toBeInTheDocument();
    const [request] = requestsTo("orders/scan-assign");
    expect(bodyOf(request)).toEqual({ qr_token: "ORD-abc" });
    expect(header(request, "Authorization")).toBe("Bearer tg.jwt.token");
    expect(header(request, "X-Request-Source")).toBe("tg-scan");
    expect(screen.getByTestId("tg-scan-count")).toHaveTextContent("1");
    // Toast: «Lobar Yusupova · Yunusobod tumani»; oxirgi skan qatori: «№10191 · Lobar Yusupova».
    expect(screen.getByText("Lobar Yusupova · Yunusobod tumani")).toBeInTheDocument();
    expect(screen.getByText("№10191 · Lobar Yusupova")).toBeInTheDocument();
    expect(screen.getByText("Sizga biriktirildi · Yunusobod tumani")).toBeInTheDocument();
    expect(webApp.HapticFeedback.notificationOccurred).toHaveBeenCalledWith("success");
  });

  it("an error shows the backend message and the next scan still goes through", async () => {
    const webApp = await renderReady();
    const message = "Boshqa filial orderi — qabul qila olmaysiz";
    routes["orders/scan-assign"] = (config) => {
      if (bodyOf(config).qr_token === "ORD-other") throw httpError(config, 403, message);
      return assigned(ORDER_54);
    };

    await decode("ORD-other");
    expect((await screen.findAllByText(message)).length).toBeGreaterThan(0);
    expect(screen.getByTestId("tg-scan-count")).toHaveTextContent("0");
    expect(webApp.HapticFeedback.notificationOccurred).toHaveBeenCalledWith("error");
    // Oqim to'xtamaydi: kamera faol.
    expect(latestCamera()?.isActive).toBe(true);

    await decode("ORD-next");
    expect(await screen.findByText("№10192 qabul qilindi")).toBeInTheDocument();
    expect(screen.getByTestId("tg-scan-count")).toHaveTextContent("1");
    expect(requestsTo("orders/scan-assign")).toHaveLength(2);
  });

  it("idempotent answer says «Allaqachon sizda» and still counts the order once", async () => {
    await renderReady();
    routes["orders/scan-assign"] = (config) =>
      bodyOf(config).qr_token === "ORD-abc" ? assigned(ORDER_53, true) : assigned(ORDER_54);

    await decode("ORD-abc");
    expect(await screen.findByText("Allaqachon sizda")).toBeInTheDocument();
    expect(screen.getByTestId("tg-scan-count")).toHaveTextContent("1");

    // O'sha posilka kamerada turib qolsa — jim (so'rov ham, xabar ham yo'q).
    await decode("ORD-abc");
    expect(requestsTo("orders/scan-assign")).toHaveLength(1);

    // Boshqa posilkadan keyin qabul qilingan token yana o'qilsa — so'rovsiz «Allaqachon qabul qilingan».
    await decode("ORD-next");
    await screen.findByText("№10192 qabul qilindi");
    await decode("ORD-abc");
    expect(await screen.findByText("Allaqachon qabul qilingan")).toBeInTheDocument();
    expect(requestsTo("orders/scan-assign")).toHaveLength(2);
    expect(screen.getByTestId("tg-scan-count")).toHaveTextContent("2");
  });

  it("a code the camera keeps seeing is not re-sent, and a different parcel right after is not «too fast»", async () => {
    await renderReady();
    routes["orders/scan-assign"] = (config) => assigned(bodyOf(config).qr_token === "ORD-a" ? ORDER_53 : ORDER_54);

    await decode("ORD-a");
    await screen.findByText("№10191 qabul qilindi");
    // 2,5 s keyin ham o'sha kod (takror filtri 1,8 s) — so'rov yo'q.
    now += 2_500;
    await act(async () => {
      latestCamera()?.onDecode("ORD-a");
    });
    expect(requestsTo("orders/scan-assign")).toHaveLength(1);

    // Darhol keyingi posilka (700 ms pauza ichida) — «Juda tez» chiqmaydi, keyingi kadrda qabul qilinadi.
    now += 200;
    await act(async () => {
      latestCamera()?.onDecode("ORD-b");
    });
    expect(screen.queryByText(/Juda tez/)).not.toBeInTheDocument();
    expect(requestsTo("orders/scan-assign")).toHaveLength(1);
    now += 800;
    await act(async () => {
      latestCamera()?.onDecode("ORD-b");
    });
    expect(await screen.findByText("№10192 qabul qilindi")).toBeInTheDocument();
    expect(screen.getByTestId("tg-scan-count")).toHaveTextContent("2");
  });

  it("«Tayyor» posts the accepted order ids to telegram/scan/done and then closes the Mini App", async () => {
    const webApp = await renderReady();
    routes["orders/scan-assign"] = (config) => assigned(bodyOf(config).qr_token === "ORD-a" ? ORDER_53 : ORDER_54);
    routes["telegram/scan/done"] = () => ({ statusCode: 200, message: "success", data: { accepted: 2, ignored: 0 } });

    await decode("ORD-a");
    await screen.findByText("№10191 qabul qilindi");
    await decode("ORD-b");
    await screen.findByText("№10192 qabul qilindi");

    fireEvent.click(screen.getByRole("button", { name: "Tayyor" }));

    await waitFor(() => expect(webApp.close).toHaveBeenCalledTimes(1));
    const [done] = requestsTo("telegram/scan/done");
    expect(bodyOf(done)).toEqual({ order_ids: ["53", "54"] });
    expect(header(done, "Authorization")).toBe("Bearer tg.jwt.token");
    expect(header(done, "X-Request-Source")).toBe("tg-scan");
  });

  it("«Tayyor» without accepted scans closes without calling scan/done", async () => {
    const webApp = await renderReady();

    fireEvent.click(screen.getByRole("button", { name: "Tayyor" }));

    await waitFor(() => expect(webApp.close).toHaveBeenCalledTimes(1));
    expect(requestsTo("telegram/scan/done")).toHaveLength(0);
  });

  it("a failed scan/done shows the message and still lets the courier close", async () => {
    const webApp = await renderReady();
    routes["orders/scan-assign"] = () => assigned(ORDER_53);
    routes["telegram/scan/done"] = (config) => {
      throw httpError(config, 400, "order_ids: 1..200 ta buyurtma id");
    };

    await decode("ORD-a");
    await screen.findByText("№10191 qabul qilindi");
    fireEvent.click(screen.getByRole("button", { name: "Tayyor" }));

    const card = await screen.findByRole("alert");
    expect(within(card).getByText("Xulosa yuborilmadi")).toBeInTheDocument();
    expect(within(card).getByText(/order_ids: 1\.\.200 ta buyurtma id/)).toBeInTheDocument();
    expect(webApp.close).not.toHaveBeenCalled();

    fireEvent.click(within(card).getByRole("button", { name: "Yopish" }));
    expect(webApp.close).toHaveBeenCalledTimes(1);
  });

  it("an expired Mini App token (401) asks to reopen the Mini App", async () => {
    await renderReady();
    routes["orders/scan-assign"] = (config) => {
      throw httpError(config, 401, "Unauthorized");
    };

    await decode("ORD-a");

    expect(await screen.findByText("Sessiya muddati tugadi")).toBeInTheDocument();
    expect(screen.getByText(/Mini App'ni qayta oching/)).toBeInTheDocument();
  });

  it("when the camera cannot start, «Telegram skaneri» feeds showScanQrPopup results into the same flow", async () => {
    camera.result = { ...camera.idle, cameraError: "Permission denied" };
    const webApp = await renderReady();
    routes["orders/scan-assign"] = () => assigned(ORDER_53);

    expect(screen.getByText("Kamera ochilmadi")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Telegram skaneri" }));

    expect(webApp.showScanQrPopup).toHaveBeenCalledTimes(1);
    const [params, callback] = webApp.showScanQrPopup.mock.calls[0] as [{ text: string }, (text: string) => boolean];
    expect(params.text).toBe("Buyurtma QR kodini ramkaga olib keling");

    let closePopup = false;
    await act(async () => {
      closePopup = callback("ORD-abc");
    });
    // `true` — har skandan keyin oyna yopiladi (natija ko'rinsin).
    expect(closePopup).toBe(true);
    expect(await screen.findByText("№10191 qabul qilindi")).toBeInTheDocument();
    expect(bodyOf(requestsTo("orders/scan-assign")[0])).toEqual({ qr_token: "ORD-abc" });
  });

  it("«Ro'yxat» opens the session list with each scan", async () => {
    await renderReady();
    routes["orders/scan-assign"] = () => assigned(ORDER_53);

    await decode("ORD-a");
    await screen.findByText("№10191 qabul qilindi");
    fireEvent.click(screen.getByRole("button", { name: "Ro'yxat" }));

    const sheet = await screen.findByRole("dialog", { name: "Skanerlanganlar" });
    expect(within(sheet).getByText("1 ta qabul qilindi · 0 ta xato")).toBeInTheDocument();
    expect(within(sheet).getByText("№10191 · Lobar Yusupova")).toBeInTheDocument();
  });
});
