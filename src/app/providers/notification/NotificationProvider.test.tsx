import { act, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { onlineManager, QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import type { ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { vi } from "vitest";
import i18n from "../../../i18n";
import { notify } from "../../../shared/lib/notify";
import { Toaster } from "../../../shared/ui/primitives";
import { createAppQueryClient } from "../../lib/provider";
import {
  NotificationProvider,
  useAppNotification,
} from "./NotificationProvider";

// Ilovada NotificationProvider doim QueryClientProvider ichida turadi
// ("Qayta urinish" so'rovlarni qayta yuklaydi, sahifani emas). Xabarlar — haqiqiy `notify` + `<Toaster />`.
let queryClient: QueryClient;
const render = (ui: ReactElement) =>
  rtlRender(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        {ui}
        <Toaster />
      </QueryClientProvider>
    </I18nextProvider>,
  );

const successMock = vi.spyOn(notify, "success");
const errorMock = vi.spyOn(notify, "error");

const TestConsumer = () => {
  const { apiRequest } = useAppNotification();

  return (
    <div>
      <button
        onClick={() =>
          apiRequest({
            request: async () => ({ ok: true }),
            successMessage: "Saved",
          })
        }
      >
        success-case
      </button>
      <button
        onClick={() =>
          apiRequest({
            request: async () => {
              throw new Error("Boom");
            },
            errorMessage: "Fallback error",
          })
        }
      >
        error-case
      </button>
    </div>
  );
};

// successMessage funksiya ko'rinishida: xabar javobdan quriladi.
const onSuccessSpy = vi.fn();
const onErrorSpy = vi.fn();
const resultSpy = vi.fn();

const CallbackConsumer = () => {
  const { apiRequest } = useAppNotification();

  return (
    <div>
      <button
        onClick={async () =>
          resultSpy(
            await apiRequest({
              request: async () => ({ approved: 3, skipped: 1 }),
              successMessage: (data) => `${data.approved} ta bajarildi, ${data.skipped} ta o'tkazildi`,
              onSuccess: onSuccessSpy,
              onError: onErrorSpy,
            }),
          )
        }
      >
        callback-case
      </button>
      <button
        onClick={() =>
          apiRequest({
            request: async () => ({ ok: true }),
          })
        }
      >
        default-case
      </button>
      <button
        onClick={async () =>
          resultSpy(
            await apiRequest({
              request: async () => ({ ok: true }),
              successMessage: () => {
                throw new Error("formatter broke");
              },
              onSuccess: onSuccessSpy,
              onError: onErrorSpy,
            }),
          )
        }
      >
        throwing-callback-case
      </button>
    </div>
  );
};

describe("NotificationProvider", () => {
  beforeEach(() => {
    queryClient = new QueryClient();
    successMock.mockClear();
    errorMock.mockClear();
  });

  it("renders children", () => {
    render(
      <NotificationProvider>
        <div>child-content</div>
      </NotificationProvider>,
    );

    expect(screen.getByText("child-content")).toBeInTheDocument();
  });

  it("shows the network error toast once with a «Qayta urinish» action that refetches active queries", async () => {
    const user = userEvent.setup();
    const refetch = vi.spyOn(queryClient, "refetchQueries").mockResolvedValue();
    render(
      <NotificationProvider>
        <div />
      </NotificationProvider>,
    );

    act(() => {
      window.dispatchEvent(new Event("elchi:network-error"));
      window.dispatchEvent(new Event("elchi:network-error"));
    });

    // Taxta `tizim-errors` 03: «Internet aloqasi yo'q» — barcha sahifalarda shu nom.
    expect(await screen.findByText("Internet aloqasi yo'q")).toBeInTheDocument();
    expect(screen.getAllByText("Internet aloqasi yo'q")).toHaveLength(1);
    expect(screen.getByText("Internetga ulanishni tekshiring va qayta urinib ko'ring.")).toBeInTheDocument();
    expect(errorMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalledWith({ type: "active" });
  });

  it("vaqt tugagan so'rov (ECONNABORTED) — «Server javob bermadi», internetni tekshirish so'ralmaydi", async () => {
    render(
      <NotificationProvider>
        <div />
      </NotificationProvider>,
    );

    act(() => {
      window.dispatchEvent(new CustomEvent("elchi:network-error", { detail: { code: "ECONNABORTED" } }));
    });

    expect(await screen.findByText("Server javob bermadi")).toBeInTheDocument();
    expect(screen.getByText("Birozdan keyin qayta urinib ko'ring.")).toBeInTheDocument();
    expect(screen.queryByText("Internet aloqasi yo'q")).not.toBeInTheDocument();
  });

  describe("tarmoq holati (G6F68ti6)", () => {
    const restored = (kind: "offline" | "timeout") =>
      act(() => {
        window.dispatchEvent(new CustomEvent("elchi:network-restored", { detail: { kind } }));
      });

    afterEach(() => {
      vi.useRealTimers();
      act(() => onlineManager.setOnline(true));
    });

    it("aloqa qaytsa «Internet aloqasi yo'q» yopiladi, «Aloqa tiklandi» 3 s ko'rinib yo'qoladi", () => {
      vi.useFakeTimers();
      render(
        <NotificationProvider>
          <div />
        </NotificationProvider>,
      );

      act(() => {
        window.dispatchEvent(new CustomEvent("elchi:network-error", { detail: { kind: "offline" } }));
      });
      expect(screen.getByText("Internet aloqasi yo'q")).toBeInTheDocument();
      // Holat xabari: 20 s o'tsa ham o'zi yopilmaydi.
      act(() => vi.advanceTimersByTime(20_000));
      expect(screen.getByText("Internet aloqasi yo'q")).toBeInTheDocument();

      restored("offline");
      act(() => vi.advanceTimersByTime(300));
      expect(screen.queryByText("Internet aloqasi yo'q")).not.toBeInTheDocument();
      expect(screen.getByText("Aloqa tiklandi")).toBeInTheDocument();
      expect(screen.getByText("Ochiq sahifadagi ma'lumotlar yangilandi.")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3_300));
      expect(screen.queryByText("Aloqa tiklandi")).not.toBeInTheDocument();
    });

    it("«Server javob bermadi» fon javobidan yopilmaydi va «Aloqa tiklandi» chiqmaydi", () => {
      vi.useFakeTimers();
      render(
        <NotificationProvider>
          <div />
        </NotificationProvider>,
      );

      act(() => {
        window.dispatchEvent(new CustomEvent("elchi:network-error", { detail: { kind: "timeout" } }));
      });
      restored("timeout");
      act(() => vi.advanceTimersByTime(4_000));
      expect(screen.getByText("Server javob bermadi")).toBeInTheDocument();
      expect(screen.queryByText("Aloqa tiklandi")).not.toBeInTheDocument();
    });

    it("tiklanganda faqat javobsiz yiqilgan faol so'rovlar qayta so'raladi", () => {
      const refetch = vi.spyOn(queryClient, "refetchQueries").mockResolvedValue();
      render(
        <NotificationProvider>
          <div />
        </NotificationProvider>,
      );

      restored("offline");
      const call = refetch.mock.calls.find(([filters]) => typeof filters?.predicate === "function");
      expect(call?.[0]).toMatchObject({ type: "active" });
      const predicate = call![0]!.predicate!;
      const query = (state: Record<string, unknown>) => ({ state }) as never;
      const networkError = { isAxiosError: true, code: "ERR_NETWORK" };
      expect(predicate(query({ status: "error", error: networkError }))).toBe(true);
      expect(predicate(query({ status: "error", error: { isAxiosError: true, response: { status: 500 } } }))).toBe(false);
      expect(predicate(query({ status: "success", error: null }))).toBe(false);
    });

    it("oflaynda «Qayta urinish» xabarni yopmaydi — aloqa qaytguncha turadi", async () => {
      const user = userEvent.setup();
      const refetch = vi.spyOn(queryClient, "refetchQueries").mockResolvedValue();
      render(
        <NotificationProvider>
          <div />
        </NotificationProvider>,
      );

      act(() => {
        window.dispatchEvent(new CustomEvent("elchi:network-error", { detail: { kind: "offline" } }));
      });
      await user.click(await screen.findByRole("button", { name: "Qayta urinish" }));
      expect(refetch).toHaveBeenCalledWith({ type: "active" });
      expect(screen.getByText("Internet aloqasi yo'q")).toBeInTheDocument();
    });

    it("brauzer oflayn bo'lishi bilan (so'rovsiz ham) xabar chiqadi; onlayn — faol so'rovlar qayta yuboriladi", async () => {
      const refetch = vi.spyOn(queryClient, "refetchQueries").mockResolvedValue();
      render(
        <NotificationProvider>
          <div />
        </NotificationProvider>,
      );

      act(() => onlineManager.setOnline(false));
      expect(await screen.findByText("Internet aloqasi yo'q")).toBeInTheDocument();
      act(() => onlineManager.setOnline(true));
      expect(refetch).toHaveBeenCalledWith({ type: "active" });
      // «Tiklandi» — faqat haqiqiy javobdan (captive portal), brauzer `online` dan emas.
      expect(screen.queryByText("Aloqa tiklandi")).not.toBeInTheDocument();
    });

    it("apiRequest: javobsiz xatoda ikkinchi «Xatolik» chiqmaydi (interceptor xabari yetarli)", async () => {
      const user = userEvent.setup();
      const NetworkConsumer = () => {
        const { apiRequest } = useAppNotification();
        return (
          <button
            onClick={() =>
              apiRequest({
                request: async () => {
                  throw Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK" });
                },
                errorMessage: "Saqlanmadi",
              })
            }
          >
            network-case
          </button>
        );
      };
      render(
        <NotificationProvider>
          <NetworkConsumer />
        </NotificationProvider>,
      );

      await user.click(screen.getByRole("button", { name: "network-case" }));
      expect(errorMock).not.toHaveBeenCalled();
      expect(screen.queryByText("Network Error")).not.toBeInTheDocument();
    });
  });

  describe("«Ma'lumotni yuklab bo'lmadi» (G6F68ti6, 5-band)", () => {
    const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
    const badGateway = () =>
      new AxiosError("Request failed with status code 502", AxiosError.ERR_BAD_RESPONSE, config, {}, {
        status: 502,
        statusText: "",
        headers: {},
        config,
        data: {},
      } as AxiosResponse);
    const TITLE = "Ma'lumotni yuklab bo'lmadi";

    const Reader = ({ id, fetcher }: { id: string; fetcher: () => Promise<string> }) => {
      const query = useQuery({ queryKey: ["g6-5", id], queryFn: fetcher, retry: false });
      return (
        <button type="button" onClick={() => void query.refetch()}>
          {`refetch-${id}`}
        </button>
      );
    };

    beforeEach(() => {
      // Ilovadagi `QueryClient` — global xato va «tiklandi» hodisalari shu yerda ulanadi.
      queryClient = createAppQueryClient();
    });
    afterEach(() => {
      act(() => notify.dismiss());
      queryClient.clear();
    });

    it("so'rov tiklansa xabar o'zi yopiladi", async () => {
      const user = userEvent.setup();
      const fetcher = vi.fn<() => Promise<string>>().mockRejectedValueOnce(badGateway()).mockResolvedValue("ok");
      render(
        <NotificationProvider>
          <Reader id="a" fetcher={fetcher} />
        </NotificationProvider>,
      );

      expect(await screen.findByText(TITLE)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "refetch-a" }));

      await waitFor(() => expect(screen.queryByText(TITLE)).not.toBeInTheDocument());
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it("bir sabab bilan ikki so'rov yiqilsa — bitta xabar, ikkalasi tiklanguncha turadi", async () => {
      const user = userEvent.setup();
      const first = vi.fn<() => Promise<string>>().mockRejectedValueOnce(badGateway()).mockResolvedValue("ok");
      const second = vi.fn<() => Promise<string>>().mockRejectedValueOnce(badGateway()).mockResolvedValue("ok");
      render(
        <NotificationProvider>
          <Reader id="a" fetcher={first} />
          <Reader id="b" fetcher={second} />
        </NotificationProvider>,
      );

      await waitFor(() => expect(second).toHaveBeenCalledTimes(1));
      expect(await screen.findAllByText(TITLE)).toHaveLength(1);

      await user.click(screen.getByRole("button", { name: "refetch-a" }));
      await waitFor(() => expect(first).toHaveBeenCalledTimes(2));
      expect(screen.getByText(TITLE)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "refetch-b" }));
      await waitFor(() => expect(screen.queryByText(TITLE)).not.toBeInTheDocument());
    });

    it("ochiq sahifa kuzatmayotgan so'rov (prefetch) xatosi xabar bermaydi", async () => {
      render(
        <NotificationProvider>
          <div>page</div>
        </NotificationProvider>,
      );

      await act(() =>
        queryClient.prefetchQuery({ queryKey: ["g6-5", "prefetch"], queryFn: () => Promise.reject(badGateway()), retry: false }),
      );

      expect(errorMock).not.toHaveBeenCalled();
      expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
    });
  });

  it("shows success notification for successful request", async () => {
    const user = userEvent.setup();

    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>,
    );

    await user.click(screen.getByRole("button", { name: "success-case" }));

    await waitFor(() => {
      expect(successMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ description: "Saved" }));
    });
  });

  it("shows error notification for failed request", async () => {
    const user = userEvent.setup();

    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>,
    );

    await user.click(screen.getByRole("button", { name: "error-case" }));

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ description: "Boom" }));
    });
  });

  it("builds the success text from the response when successMessage is a function", async () => {
    const user = userEvent.setup();

    render(
      <NotificationProvider>
        <CallbackConsumer />
      </NotificationProvider>,
    );

    await user.click(screen.getByRole("button", { name: "callback-case" }));

    await waitFor(() => {
      expect(successMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ description: "3 ta bajarildi, 1 ta o'tkazildi" }));
    });
    expect(onSuccessSpy).toHaveBeenCalledWith({ approved: 3, skipped: 1 });
    expect(resultSpy).toHaveBeenCalledWith({ approved: 3, skipped: 1 });
    expect(errorMock).not.toHaveBeenCalled();
  });

  it("keeps a successful request successful when the message builder throws", async () => {
    const user = userEvent.setup();

    render(
      <NotificationProvider>
        <CallbackConsumer />
      </NotificationProvider>,
    );

    // successMessage berilmagandagi odatiy matn — solishtirish uchun.
    await user.click(screen.getByRole("button", { name: "default-case" }));
    await waitFor(() => expect(successMock).toHaveBeenCalledTimes(1));
    const defaultDescription = successMock.mock.calls[0][1]?.description;

    await user.click(screen.getByRole("button", { name: "throwing-callback-case" }));

    await waitFor(() => expect(successMock).toHaveBeenCalledTimes(2));
    expect(successMock.mock.calls[1][1]?.description).toBe(defaultDescription);
    expect(onSuccessSpy).toHaveBeenCalledWith({ ok: true });
    expect(resultSpy).toHaveBeenCalledWith({ ok: true });
    expect(onErrorSpy).not.toHaveBeenCalled();
    expect(errorMock).not.toHaveBeenCalled();
  });

  it("throws when hook is used outside provider", () => {
    const Broken = () => {
      useAppNotification();
      return null;
    };

    expect(() => render(<Broken />)).toThrow(
      "useAppNotification must be used within <NotificationProvider>",
    );
  });
});
