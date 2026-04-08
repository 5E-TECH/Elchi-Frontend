import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import {
  NotificationProvider,
  useAppNotification,
} from "./NotificationProvider";

const successMock = vi.fn();
const errorMock = vi.fn();

vi.mock("antd", () => ({
  notification: {
    useNotification: () => [
      {
        success: successMock,
        error: errorMock,
      },
      <div key="holder">holder</div>,
    ],
  },
}));

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

describe("NotificationProvider", () => {
  beforeEach(() => {
    successMock.mockReset();
    errorMock.mockReset();
  });

  it("renders children and context holder", () => {
    render(
      <NotificationProvider>
        <div>child-content</div>
      </NotificationProvider>,
    );

    expect(screen.getByText("child-content")).toBeInTheDocument();
    expect(screen.getByText("holder")).toBeInTheDocument();
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
      expect(successMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Saved",
        }),
      );
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
      expect(errorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Boom",
        }),
      );
    });
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
