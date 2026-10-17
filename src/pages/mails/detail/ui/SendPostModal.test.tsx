import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Branch } from "../../../../entities/branch";
import i18n from "../../../../i18n";
import { renderWithProviders } from "../../../../test/test-utils";
import SendPostModal from "./SendPostModal";

/** «Filialni tanlang» oynasi (maketlar `*-mails-detail-send-dialog`, `admin-mails-send-branch-dialog`). */

const mocks = vi.hoisted(() => ({ dispatch: vi.fn() }));

vi.mock("../../../../entities/mails", () => ({
  useDispatchPostToBranch: () => ({ mutateAsync: mocks.dispatch, isPending: false, reset: vi.fn() }),
}));

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

const branch = (id: string, name: string, hasManager = true): Branch =>
  ({
    id,
    name,
    type: "REGIONAL",
    status: "active",
    has_manager: hasManager,
    phone_number: "+998752214018",
    region: { id: "14", name: "Qashqadaryo" },
  }) as Branch;

const BRANCHES = [branch("21", "Qarshi filiali"), branch("23", "Koson filiali", false)];

const stateFor = (role: string) => ({ role: { id: "1", role, region: null, name: role } }) as never;

const renderModal = (role = "superadmin", props: Partial<Parameters<typeof SendPostModal>[0]> = {}) => {
  const onSuccess = vi.fn();
  const onClose = vi.fn();
  renderWithProviders(
    <SendPostModal
      isOpen
      onClose={onClose}
      postId="74"
      branches={BRANCHES}
      selectedIds={new Set(["101", "102"])}
      onSuccess={onSuccess}
      regionName="Qashqadaryo"
      {...props}
    />,
    { preloadedState: stateFor(role) },
  );
  return { onSuccess, onClose };
};

describe("SendPostModal (v2)", () => {
  beforeEach(() => {
    mocks.dispatch.mockReset().mockResolvedValue({ statusCode: 200 });
  });

  it("maket matnlari; menejersiz filial o'chiq va izohli; tanlamaguncha «Jo'natish» o'chiq", () => {
    renderModal();
    const dialog = screen.getByRole("dialog", { name: "Filialni tanlang" });
    expect(within(dialog).getByText("2 ta buyurtma tanlangan filialga jo'natiladi")).toBeInTheDocument();
    expect(within(dialog).getByRole("group", { name: "Qashqadaryo viloyatidagi faol filiallar" })).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: /Koson filiali/ })).toBeDisabled();
    expect(within(dialog).getByText("Menejer biriktirilmagan — avval menejer biriktiring")).toBeInTheDocument();
    expect(within(dialog).getAllByText("+998 75 221 40 18")).toHaveLength(2);
    expect(within(dialog).getByRole("button", { name: "Jo'natish — 2 ta" })).toBeDisabled();
  });

  it("registratorda izoh — «adminga murojaat qiling» (D19)", () => {
    renderModal("registrator");
    expect(screen.getByText("Menejer biriktirilmagan — adminga murojaat qiling")).toBeInTheDocument();
  });

  it("nomida tur so'zi bo'lsa — «viloyatidagi» qo'shilmaydi", () => {
    renderModal("superadmin", { regionName: "Toshkent sh." });
    expect(screen.getByRole("group", { name: "Faol filiallar — Toshkent sh." })).toBeInTheDocument();
  });

  it("filial tanlanib yuboriladi: { destinationBranchId, orderIds }; muvaffaqiyatda onSuccess", async () => {
    const user = userEvent.setup();
    const { onSuccess, onClose } = renderModal();
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: /Qarshi filiali/ }));
    await user.click(within(dialog).getByRole("button", { name: "Jo'natish — 2 ta" }));
    await waitFor(() =>
      expect(mocks.dispatch).toHaveBeenCalledWith({
        postId: "74",
        payload: { destinationBranchId: "21", orderIds: ["101", "102"] },
      }),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(["101", "102"]));
    expect(onClose).toHaveBeenCalled();
  });

  it("«Bekor qilish» — yopadi, so'rov ketmaydi", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole("button", { name: "Bekor qilish" }));
    expect(onClose).toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});
