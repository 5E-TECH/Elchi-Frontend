import { useEffect } from "react";
import { act, screen, waitFor, within } from "@testing-library/react";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import { aiApiGet } from "../../../../test/aiOrderFixtures";
import { ORDER_CREATE_DEFAULT_VALUES, type OrderCreateFormValues } from "../model/orderCreateForm";
import Step2Combined from "./Step2Combined";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../../../shared/api/api", () => ({
  api: { get: mocks.get, post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

/**
 * XsoWhKP5: buyurtma yaratish 2-qadamida maydon xatolari ekran o'quvchiga bog'langan — «Yetkazish turi» radiolari
 * `aria-invalid` + xato matniga `aria-describedby` (guruh ham), «Kamida bitta mahsulot» xatosi mahsulot qidiruvi
 * maydoniga. `Field` ichidagi maydonlar (ism, manzil …) — `Field` ning o'zi (alohida test).
 */

const marketState = { role: { id: "7", role: "market", region: null, name: "Test market" } } as never;

let form: UseFormReturn<OrderCreateFormValues> | null = null;
const Harness = () => {
  const methods = useForm<OrderCreateFormValues>({ defaultValues: ORDER_CREATE_DEFAULT_VALUES });
  useEffect(() => {
    form = methods;
  }, [methods]);
  return (
    <FormProvider {...methods}>
      <Step2Combined />
    </FormProvider>
  );
};

const render = () => {
  mocks.get.mockReset().mockImplementation(aiApiGet);
  return renderWithProviders(<Harness />, { preloadedState: marketState });
};

describe("Step2Combined — xato matnlari maydonlarga bog'langan (XsoWhKP5)", () => {
  it("xatosiz: radiolar va qidiruvda aria-invalid / aria-describedby yo'q", () => {
    render();
    const group = screen.getByRole("group", { name: /Yetkazish turi/ });
    expect(group).not.toHaveAttribute("aria-describedby");
    for (const radio of within(group).getAllByRole("radio")) {
      expect(radio).not.toHaveAttribute("aria-invalid");
      expect(radio).not.toHaveAttribute("aria-describedby");
    }
    const search = screen.getByRole("searchbox", { name: "Mahsulot qo'shish" });
    expect(search).not.toHaveAttribute("aria-invalid");
  });

  it("«Yetkazish turi» xatosi: har radio aria-invalid, guruh va radiolar xato matni bilan tavsiflangan; fokus radioga", async () => {
    render();
    await waitFor(() => expect(form).not.toBeNull());
    act(() => form!.setError("details.where_deliver", { message: "Yetkazish turini tanlang" }, { shouldFocus: true }));

    const group = screen.getByRole("group", { name: /Yetkazish turi/ });
    expect(group).toHaveAccessibleDescription("Yetkazish turini tanlang");
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(2);
    for (const radio of radios) {
      expect(radio).toHaveAttribute("aria-invalid", "true");
      expect(radio).toHaveAccessibleDescription("Yetkazish turini tanlang");
    }
    expect(radios[0]).toHaveFocus();
  });

  it("«Kamida bitta mahsulot» xatosi: mahsulot qidiruvi aria-invalid va xato matni bilan tavsiflangan", async () => {
    render();
    await waitFor(() => expect(form).not.toBeNull());
    act(() => form!.setError("details.items", { message: "Kamida bitta mahsulot qo'shing" }));

    const search = screen.getByRole("searchbox", { name: "Mahsulot qo'shish" });
    expect(search).toHaveAttribute("aria-invalid", "true");
    expect(search).toHaveAccessibleDescription("Kamida bitta mahsulot qo'shing");
  });
});
