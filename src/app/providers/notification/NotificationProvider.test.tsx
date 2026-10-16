import { act, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { vi } from "vitest";
import i18n from "../../../i18n";
import { notify } from "../../../shared/lib/notify";
import { Toaster } from "../../../shared/ui/primitives";
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
