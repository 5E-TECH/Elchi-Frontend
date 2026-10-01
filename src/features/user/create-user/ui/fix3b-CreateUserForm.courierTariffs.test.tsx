import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import { CreateUserForm } from "./CreateUserForm";

/**
 * fix3b FE-USR-11 (docs: kuryer ulushi CourierCompensationMode ga bog'liq) —
 * bo'sh tariflar 0 bo'ladi FAQAT maosh kiritilganda (maoshli kuryer).
 * Maoshsiz kuryerda ikkala tarif majburiy, aks holda u har buyurtmadan
 * jimgina 0 olardi.
 */

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const mocks = vi.hoisted(() => ({
  createCourier: vi.fn(),
  mutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    createAdmin: mocks.mutation(),
    createManager: mocks.mutation(),
    createRegistrator: mocks.mutation(),
    createMarket: mocks.mutation(),
    createCourier: { mutateAsync: mocks.createCourier, isPending: false },
  }),
}));

// Kalendar o'rniga oddiy maydon — to'lov kuni (maosh bilan majburiy) bitta qadamda.
vi.mock("../../../../shared/ui/CustomDatePicker", () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input aria-label="payment-day" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

vi.mock("../../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../entities/branch")>()),
  useBranches: () => ({ data: { data: [] }, isLoading: false }),
}));

const superadminState = {
  role: { id: "1", role: "superadmin", region: null, name: "Superadmin" },
} as never;

const fill = async (
  user: ReturnType<typeof userEvent.setup>,
  container: HTMLElement,
  name: string,
  value: string,
) => {
  const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) throw new Error(`input not found: ${name}`);
  await user.type(input, value);
};

const openCourierForm = async () => {
  const user = userEvent.setup();
  const view = renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });
  await user.click(screen.getByRole("button", { name: "Admin" }));
  await user.click(screen.getByRole("button", { name: "Kuryer" }));
  await fill(user, view.container, "fullName", "Yangi Kuryer");
  await fill(user, view.container, "phone", "901234567");
  await fill(user, view.container, "password", "secret12");
  return { user, container: view.container };
};

describe("CreateUserForm — kuryer tariflari (fix3b FE-USR-11)", () => {
  beforeEach(() => {
    mocks.createCourier.mockReset();
    mocks.createCourier.mockResolvedValue({ statusCode: 201 });
  });

  it("maoshsiz va tarifsiz kuryer yuborilmaydi — ikkala tarifda xabar", async () => {
    const { user } = await openCourierForm();

    await user.click(screen.getByRole("button", { name: /Saqlash/ }));

    expect(await screen.findByText("Maoshsiz kuryerda uy tarifi majburiy")).toBeInTheDocument();
    expect(screen.getByText("Maoshsiz kuryerda markaz tarifi majburiy")).toBeInTheDocument();
    expect(mocks.createCourier).not.toHaveBeenCalled();
  });

  it("maoshli kuryerda bo'sh tariflar 0 / 0 bo'lib yuboriladi", async () => {
    const { user, container } = await openCourierForm();
    await fill(user, container, "salary", "3000000");
    fireEvent.change(screen.getByLabelText("payment-day"), { target: { value: "2026-10-05" } });

    await user.click(screen.getByRole("button", { name: /Saqlash/ }));

    await waitFor(() => expect(mocks.createCourier).toHaveBeenCalledTimes(1));
    expect(mocks.createCourier).toHaveBeenCalledWith(
      expect.objectContaining({ salary: 3000000, payment_day: 5, tariff_home: 0, tariff_center: 0 }),
    );
  });

  it("maoshsiz kuryer ikkala tarif bilan yuboriladi", async () => {
    const { user, container } = await openCourierForm();
    await fill(user, container, "homeRate", "10000");
    await fill(user, container, "centerRate", "8000");

    await user.click(screen.getByRole("button", { name: /Saqlash/ }));

    await waitFor(() => expect(mocks.createCourier).toHaveBeenCalledTimes(1));
    expect(mocks.createCourier).toHaveBeenCalledWith(
      expect.objectContaining({ tariff_home: 10000, tariff_center: 8000 }),
    );
    expect(mocks.createCourier.mock.calls[0][0]).not.toHaveProperty("salary");
  });

  it("maoshsiz kuryerda faqat bitta tarif — ikkinchisi so'raladi", async () => {
    const { user, container } = await openCourierForm();
    await fill(user, container, "homeRate", "10000");

    await user.click(screen.getByRole("button", { name: /Saqlash/ }));

    expect(await screen.findByText("Maoshsiz kuryerda markaz tarifi majburiy")).toBeInTheDocument();
    expect(screen.queryByText("Maoshsiz kuryerda uy tarifi majburiy")).not.toBeInTheDocument();
    expect(mocks.createCourier).not.toHaveBeenCalled();
  });
});
