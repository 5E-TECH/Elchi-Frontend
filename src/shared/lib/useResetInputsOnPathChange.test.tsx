import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation, useNavigate } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import { setFilterValue } from "../model/filterSlice";
import { setSearchValue } from "../model/searchSlice";
import { useResetInputsOnPathChange } from "./useResetInputsOnPathChange";

/**
 * iR4B6hcP — yo'l o'zgarganda faqat Redux (filtr va qidiruv ko'zgusi) tozalanadi; URL parametrlariga tegilmaydi:
 * yangi sahifa o'z `?…` i bilan ochiladi, «Orqaga» — eski sahifa filtrlari URL'da butun (ular shundan tiklanadi).
 */
const Probe = () => {
  useResetInputsOnPathChange();
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="url">{`${location.pathname}${location.search}`}</output>
      <button type="button" onClick={() => navigate("/mails/today?tab=sent")}>
        Pochta
      </button>
      <button type="button" onClick={() => navigate("/orders?where_deliver=center&page=2")}>
        Sahifa
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        Orqaga
      </button>
    </>
  );
};

describe("useResetInputsOnPathChange (iR4B6hcP)", () => {
  it("yo'l o'zgarsa — Redux filtr va qidiruv tozalanadi, URL parametrlari o'zgarmaydi", async () => {
    const { store } = renderWithProviders(<Probe />, { route: "/orders?where_deliver=center&orderSearch=ali" });
    store.dispatch(setFilterValue({ key: "where_deliver", value: "center" }));
    store.dispatch(setSearchValue({ key: "orderSearch", value: "ali" }));

    await userEvent.click(screen.getByRole("button", { name: "Pochta" }));

    expect(screen.getByTestId("url")).toHaveTextContent("/mails/today?tab=sent");
    expect(store.getState().filter).toEqual({});
    expect(store.getState().search).toEqual({});

    await userEvent.click(screen.getByRole("button", { name: "Orqaga" }));
    expect(screen.getByTestId("url")).toHaveTextContent("/orders?where_deliver=center&orderSearch=ali");
  });

  it("faqat `?…` o'zgarsa (shu sahifa, masalan sahifa raqami) — Redux tegilmaydi", async () => {
    const { store } = renderWithProviders(<Probe />, { route: "/orders?where_deliver=center" });
    store.dispatch(setFilterValue({ key: "where_deliver", value: "center" }));

    await userEvent.click(screen.getByRole("button", { name: "Sahifa" }));

    expect(screen.getByTestId("url")).toHaveTextContent("/orders?where_deliver=center&page=2");
    expect(store.getState().filter).toMatchObject({ where_deliver: "center" });
  });
});
