import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Branch } from "../../../../entities/branch";
import type { CourierDestination } from "../../../../entities/mails";
import i18n from "../../../../i18n";
import { renderWithProviders } from "../../../../test/test-utils";
import SendPostModal from "./SendPostModal";

/**
 * «Manzilni tanlang» oynasi: filial (maketlar `*-mails-detail-send-dialog`, `admin-mails-send-branch-dialog`) va
 * HQ kuryeri (ega qarori 2026-11-15; maket yo'q — eng yaqini `registrator-dispatch-courier-select-dialog`).
 */

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), dispatchCourier: vi.fn() }));

vi.mock("../../../../entities/mails", () => ({
  useDispatchPostToBranch: () => ({ mutateAsync: mocks.dispatch, isPending: false, reset: vi.fn() }),
  useDispatchPostToCourier: () => ({ mutateAsync: mocks.dispatchCourier, isPending: false, reset: vi.fn() }),
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

const courier = (overrides: Partial<CourierDestination> = {}): CourierDestination => ({
  courier_user_id: "77",
  name: "Ali Valiyev",
  phone: "+998901234567",
  region_match: "listed",
  carrier_name: null,
  carrier_active: null,
  ...overrides,
});

const BRANCHES = [branch("21", "Qarshi filiali"), branch("23", "Koson filiali", false)];
const COURIERS = [
  courier(),
  courier({
    courier_user_id: "78",
    name: "BeePost kuryeri",
    phone: "+998935550000",
    carrier_name: "BeePost",
    carrier_active: true,
  }),
  courier({ courier_user_id: "79", name: "Vodiy kuryeri", carrier_name: "Vodiy Kargo", carrier_active: false }),
  courier({ courier_user_id: "80", name: "Hamma joyda", region_match: "all_regions" }),
];

const stateFor = (role: string) => ({ role: { id: "1", role, region: null, name: role } }) as never;

type Props = Parameters<typeof SendPostModal>[0];

const renderModal = (role = "superadmin", props: Partial<Props> = {}) => {
  const onSuccess = vi.fn();
  const onClose = vi.fn();
  const onRetry = vi.fn();
  renderWithProviders(
    <SendPostModal
      isOpen
      onClose={onClose}
      postId="74"
      branches={BRANCHES}
      couriers={COURIERS}
      carrierLookupFailed={false}
      onRetry={onRetry}
      selectedIds={new Set(["101", "102"])}
      onSuccess={onSuccess}
      regionName="Qashqadaryo"
      {...props}
    />,
    { preloadedState: stateFor(role) },
  );
  return { onSuccess, onClose, onRetry };
};

const tabs = () => screen.getByRole("radiogroup", { name: "Manzil turi" });
const openCourierTab = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(within(tabs()).getByRole("radio", { name: /HQ kuryeriga/ }));

describe("SendPostModal — filial (maket)", () => {
  beforeEach(() => {
    mocks.dispatch.mockReset().mockResolvedValue({ statusCode: 200 });
    mocks.dispatchCourier.mockReset().mockResolvedValue({ statusCode: 200 });
  });

  it("«Manzilni tanlang»: tablar va sonlar, sukut — filial; menejersiz filial o'chiq va izohli; tanlamaguncha o'chiq", () => {
    renderModal();
    const dialog = screen.getByRole("dialog", { name: "Manzilni tanlang" });
    expect(within(dialog).getByText("2 ta buyurtma tanlangan filialga jo'natiladi")).toBeInTheDocument();
    expect(within(tabs()).getByRole("radio", { name: "Filialga · 2" })).toHaveAttribute("aria-checked", "true");
    expect(within(tabs()).getByRole("radio", { name: "HQ kuryeriga · 4" })).toHaveAttribute("aria-checked", "false");
    expect(within(dialog).getByRole("group", { name: "Qashqadaryo viloyatidagi faol filiallar" })).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: /Koson filiali/ })).toBeDisabled();
    expect(within(dialog).getByText("Menejer biriktirilmagan — avval menejer biriktiring")).toBeInTheDocument();
    expect(within(dialog).getByText("Filial menejeri qabul qiladi")).toBeInTheDocument();
    expect(within(dialog).getAllByText("+998 75 221 40 18")).toHaveLength(2);
    expect(within(dialog).getByRole("button", { name: "Filialga jo'natish — 2 ta" })).toBeDisabled();
    // Hech narsa oldindan tanlanmaydi.
    expect(within(dialog).getByRole("radio", { name: /Qarshi filiali/ })).not.toBeChecked();
  });

  it("registratorda izoh — «adminga murojaat qiling» (D19)", () => {
    renderModal("registrator");
    expect(screen.getByText("Menejer biriktirilmagan — adminga murojaat qiling")).toBeInTheDocument();
  });

  it("nomida tur so'zi bo'lsa — «viloyatidagi» qo'shilmaydi", () => {
    renderModal("superadmin", { regionName: "Toshkent sh." });
    expect(screen.getByRole("group", { name: "Faol filiallar — Toshkent sh." })).toBeInTheDocument();
  });

  it("filial tanlanib yuboriladi (tanasi o'zgarmagan): { destinationBranchId, orderIds }; muvaffaqiyatda onSuccess", async () => {
    const user = userEvent.setup();
    const { onSuccess, onClose } = renderModal();
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: /Qarshi filiali/ }));
    await user.click(within(dialog).getByRole("button", { name: "Filialga jo'natish — 2 ta" }));
    await waitFor(() =>
      expect(mocks.dispatch).toHaveBeenCalledWith({
        postId: "74",
        payload: { destinationBranchId: "21", orderIds: ["101", "102"] },
      }),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(["101", "102"]));
    expect(onClose).toHaveBeenCalled();
    expect(mocks.dispatchCourier).not.toHaveBeenCalled();
  });

  it("«Bekor qilish» — yopadi, so'rov ketmaydi", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole("button", { name: "Bekor qilish" }));
    expect(onClose).toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});

describe("SendPostModal — HQ kuryeri (ega qarori 2026-11-15)", () => {
  beforeEach(() => {
    mocks.dispatch.mockReset().mockResolvedValue({ statusCode: 200 });
    mocks.dispatchCourier.mockReset().mockResolvedValue({
      statusCode: 200,
      data: { moved_order_ids: ["101", "102"], moved_orders_count: 2, skipped_order_ids: [], post_deleted: false },
    });
  });

  it("filial yo'q — oyna kuryer tabida ochiladi; filial tabida «faol filial yo'q»", async () => {
    const user = userEvent.setup();
    renderModal("superadmin", { branches: [] });
    expect(within(tabs()).getByRole("radio", { name: "HQ kuryeriga · 4" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("2 ta buyurtma HQ kuryeriga beriladi — filialga bormaydi")).toBeInTheDocument();
    await user.click(within(tabs()).getByRole("radio", { name: "Filialga · 0" }));
    expect(screen.getByText("Bu viloyatda faol filial yo'q")).toBeInTheDocument();
  });

  it("kuryer kartasi: «HQ kuryeri», «Tashqi: «X»», «To'xtatilgan» (o'chiq + izoh), «Barcha viloyatlar»; ogohlantirish", async () => {
    const user = userEvent.setup();
    renderModal();
    await openCourierTab(user);
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(
        "Kuryerga berilgan buyurtmalar filialga bormaydi: ular darhol kuryer pochtasiga o'tadi va «Yo'lda» bo'ladi.",
      ),
    ).toBeInTheDocument();
    const group = within(dialog).getByRole("group", { name: "Qashqadaryo — HQ kuryerlari" });
    expect(within(group).getAllByText("HQ kuryeri")).toHaveLength(4);
    expect(within(group).getByText("Tashqi: «BeePost»")).toBeInTheDocument();
    expect(within(group).getByText("Tashqi: «Vodiy Kargo»")).toBeInTheDocument();
    expect(within(group).getByText("To'xtatilgan")).toBeInTheDocument();
    expect(
      within(group).getByText("Tashqi yetkazuvchi akkaunti to'xtatilgan — avval Integratsiyalarda yoqing"),
    ).toBeInTheDocument();
    expect(within(group).getByRole("radio", { name: /Vodiy kuryeri/ })).toBeDisabled();
    expect(within(group).getByText("Barcha viloyatlar")).toBeInTheDocument();
    expect(within(group).getAllByText("+998 90 123 45 67").length).toBeGreaterThan(0);
    // Asosiy tugma turga qarab; tanlamaguncha o'chiq.
    expect(within(dialog).getByRole("button", { name: "Kuryerga berish — 2 ta" })).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: /Filialga jo'natish/ })).not.toBeInTheDocument();
  });

  it("tur almashsa ikkala tanlov tozalanadi", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("radio", { name: /Qarshi filiali/ }));
    expect(screen.getByRole("radio", { name: /Qarshi filiali/ })).toBeChecked();
    await openCourierTab(user);
    await user.click(screen.getByRole("radio", { name: /Ali Valiyev/ }));
    expect(screen.getByRole("button", { name: "Kuryerga berish — 2 ta" })).toBeEnabled();
    await user.click(within(tabs()).getByRole("radio", { name: /Filialga/ }));
    expect(screen.getByRole("radio", { name: /Qarshi filiali/ })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Filialga jo'natish — 2 ta" })).toBeDisabled();
    await openCourierTab(user);
    expect(screen.getByRole("radio", { name: /Ali Valiyev/ })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Kuryerga berish — 2 ta" })).toBeDisabled();
  });

  it("tasdiq bosqichi: kuryer, tashqi yetkazuvchi, «Filial menejeri qabul qilmaydi»; «Orqaga» — so'rovsiz", async () => {
    const user = userEvent.setup();
    renderModal();
    await openCourierTab(user);
    await user.click(screen.getByRole("radio", { name: /BeePost kuryeri/ }));
    await user.click(screen.getByRole("button", { name: "Kuryerga berish — 2 ta" }));

    const dialog = screen.getByRole("dialog", { name: "Kuryerga berilsinmi?" });
    expect(within(dialog).getByText("BeePost kuryeri")).toBeInTheDocument();
    expect(within(dialog).getByText("+998 93 555 00 00")).toBeInTheDocument();
    expect(within(dialog).getByText("Tashqi: «BeePost»")).toBeInTheDocument();
    expect(within(dialog).getByText("Qashqadaryo")).toBeInTheDocument();
    expect(within(dialog).getByText("2 ta buyurtma")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "2 ta buyurtma tashqi yetkazuvchi «BeePost» (kuryer BeePost kuryeri) ga beriladi. Filial menejeri qabul qilmaydi.",
      ),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Orqaga" }));
    expect(mocks.dispatchCourier).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Manzilni tanlang" })).toBeInTheDocument();
    // Tanlov saqlanadi — qayta tasdiqqa o'tish mumkin.
    expect(screen.getByRole("radio", { name: /BeePost kuryeri/ })).toBeChecked();
  });

  it("tasdiqni chetlab bo'lmaydi: fokus «Orqaga»da, «Kuryerga berish» ikki marta bosilsa — faqat tasdiq bosqichi", async () => {
    const user = userEvent.setup();
    renderModal();
    await openCourierTab(user);
    await user.click(screen.getByRole("radio", { name: /Ali Valiyev/ }));
    // Klaviatura: Enter — tasdiq bosqichi, fokus «Orqaga»da (Enter takrori berib yubormaydi).
    screen.getByRole("button", { name: "Kuryerga berish — 2 ta" }).focus();
    await user.keyboard("{Enter}");
    let dialog = screen.getByRole("dialog", { name: "Kuryerga berilsinmi?" });
    expect(within(dialog).getByRole("button", { name: "Orqaga" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(mocks.dispatchCourier).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Manzilni tanlang" })).toBeInTheDocument();

    // Sichqoncha: ikkinchi bosish shu joyga chiqqan «Ha, kuryerga berish»ga tushadi (React o'sha DOM tugmani qayta
    // ishlatadi) — e'tiborsiz.
    await user.dblClick(screen.getByRole("button", { name: "Kuryerga berish — 2 ta" }));
    dialog = screen.getByRole("dialog", { name: "Kuryerga berilsinmi?" });
    expect(mocks.dispatchCourier).not.toHaveBeenCalled();

    // Alohida bosish — beriladi.
    await user.click(within(dialog).getByRole("button", { name: "Ha, kuryerga berish" }));
    await waitFor(() => expect(mocks.dispatchCourier).toHaveBeenCalledTimes(1));
  });

  it("tasdiqda «Ha, kuryerga berish» → { courierId, orderIds }; xabar va onSuccess (backend bergan id'lar)", async () => {
    const user = userEvent.setup();
    mocks.dispatchCourier.mockResolvedValue({
      statusCode: 200,
      data: { moved_order_ids: ["101"], moved_orders_count: 1, skipped_order_ids: ["102"], post_deleted: false },
    });
    const { onSuccess, onClose } = renderModal();
    await openCourierTab(user);
    await user.click(screen.getByRole("radio", { name: /Ali Valiyev/ }));
    await user.click(screen.getByRole("button", { name: "Kuryerga berish — 2 ta" }));
    const dialog = screen.getByRole("dialog", { name: "Kuryerga berilsinmi?" });
    expect(
      within(dialog).getByText(
        "2 ta buyurtma HQ kuryeri Ali Valiyevga to'g'ridan-to'g'ri beriladi. Filial menejeri qabul qilmaydi.",
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Ha, kuryerga berish" }));

    await waitFor(() =>
      expect(mocks.dispatchCourier).toHaveBeenCalledWith({
        postId: "74",
        payload: { courierId: "77", orderIds: ["101", "102"] },
      }),
    );
    expect(await screen.findByText("1 ta buyurtma kuryer Ali Valiyevga berildi.")).toBeInTheDocument();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(["101"]));
    expect(onClose).toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("server rad etsa — backend xabari, oyna ochiq qoladi", async () => {
    const user = userEvent.setup();
    mocks.dispatchCourier.mockRejectedValue({
      response: {
        status: 403,
        data: {
          message: "Kuryer bu viloyatga xizmat qilmaydi — «Xizmat viloyatlari»da belgilanmagan",
          data: { reason: "courier_region_not_served", details: { courier_id: "77", post_region_id: "14" } },
        },
      },
    });
    const { onSuccess } = renderModal();
    await openCourierTab(user);
    await user.click(screen.getByRole("radio", { name: /Ali Valiyev/ }));
    await user.click(screen.getByRole("button", { name: "Kuryerga berish — 2 ta" }));
    await user.click(screen.getByRole("button", { name: "Ha, kuryerga berish" }));
    expect(
      await screen.findByText("Kuryer bu viloyatga xizmat qilmaydi — «Xizmat viloyatlari»da belgilanmagan"),
    ).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Kuryerga berilsinmi?" })).toBeInTheDocument();
  });

  it("kuryer yo'q — bo'sh holat va rolga qarab izoh (admin)", async () => {
    const user = userEvent.setup();
    renderModal("admin", { couriers: [] });
    await openCourierTab(user);
    expect(screen.getByText("Bu viloyatda HQ kuryeri yo'q")).toBeInTheDocument();
    expect(
      screen.getByText("Kuryerni viloyatga biriktirish: Foydalanuvchilar → kuryer → «Xizmat viloyatlari»."),
    ).toBeInTheDocument();
  });

  it("registratorda bo'sh kuryer ro'yxati — «adminga murojaat qiling»", async () => {
    const user = userEvent.setup();
    renderModal("registrator", { couriers: [] });
    await openCourierTab(user);
    expect(screen.getByText("HQ kuryerini viloyatga admin biriktiradi — adminga murojaat qiling.")).toBeInTheDocument();
  });

  it("kuryerlar xatosi — o'z tabida ErrorState + «Qayta urinish» (onRetry('courier')), tabda son yo'q", async () => {
    const user = userEvent.setup();
    const { onRetry } = renderModal("superadmin", {
      couriers: null,
      couriersError: { response: { status: 500, data: { message: "Server xatosi" } } },
    });
    await user.click(within(tabs()).getByRole("radio", { name: "HQ kuryeriga" }));
    expect(screen.getByText("Kuryerlarni yuklab bo'lmadi.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(onRetry).toHaveBeenCalledWith("courier");
  });

  it("filiallar xatosi, kuryer bor — oyna kuryer tabida, filial tabida ErrorState", async () => {
    const user = userEvent.setup();
    const { onRetry } = renderModal("superadmin", { branches: null, branchesError: {} });
    expect(within(tabs()).getByRole("radio", { name: "HQ kuryeriga · 4" })).toHaveAttribute("aria-checked", "true");
    await user.click(within(tabs()).getByRole("radio", { name: "Filialga" }));
    expect(screen.getByText("Filiallarni yuklab bo'lmadi.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(onRetry).toHaveBeenCalledWith("branch");
  });

  it("tashqi yetkazuvchi ma'lumoti olinmadi — ro'yxat ustida izoh", async () => {
    const user = userEvent.setup();
    renderModal("superadmin", { carrierLookupFailed: true });
    await openCourierTab(user);
    expect(screen.getByText("Tashqi yetkazuvchi ma'lumotini olib bo'lmadi")).toBeInTheDocument();
  });

  it("ikkala ro'yxat bo'sh va xatosiz — oyna ochilmaydi", () => {
    renderModal("superadmin", { branches: [], couriers: [] });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
