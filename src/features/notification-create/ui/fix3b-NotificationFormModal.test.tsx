import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NotificationFormModal from "./NotificationFormModal";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * fix3b CODE-02 — "Token orqali ulash" bo'limi olib tashlandi: u
 * `{ token }` yuborardi, `POST /notifications/connect-by-token` esa
 * `{ text, group_id }` talab qiladi (doim 400). Guruh botda (market tokeni
 * bilan) yoki shu forma orqali (market + Group ID) ulanadi.
 */

const apiPostMock = vi.fn();

vi.mock("../../../shared/api/instance", () => ({
  api: { post: (...args: unknown[]) => apiPostMock(...args) },
}));

vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({
    useGetMarkets: () => ({ data: { data: [{ id: "201", name: "Yandex" }] }, isLoading: false }),
  }),
}));

describe("NotificationFormModal (fix3b CODE-02)", () => {
  it("token orqali ulash bo'limi yo'q, qo'lda ulash formasi bor", () => {
    renderWithProviders(<NotificationFormModal open onClose={vi.fn()} />);

    expect(screen.getByText("Bildirishnoma qo'shish")).toBeInTheDocument();
    expect(screen.getByText("Telegram group ID")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bildirishnomani saqlash" })).toBeInTheDocument();

    expect(screen.queryByText("Token orqali ulash")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Token")).not.toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
  });
});
