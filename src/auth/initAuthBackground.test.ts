import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import store from "../app/config/store";
import { setAppInitializing } from "../entities/user/model/slice";
import { removeRole, setRole } from "../shared/model/roleSlice";
import { authClient, initAuth } from "./authService";
import tokenStorage from "./tokenStorage";

/**
 * G6F68ti6 (10-band): aloqa qaytgandan keyingi qayta urinish (`initAuth({ background: true })`) ilovani yuklanish
 * ekrani ostiga yashirmaydi — rol tiklangan, foydalanuvchi ochiq sahifada ishlayapti. Oddiy ochilish (fon emas) —
 * avvalgidek yuklanish holatida.
 */
describe("initAuth — fon rejimi (aloqa qaytganda)", () => {
  const seen: boolean[] = [];
  let unsubscribe: () => void = () => {};

  beforeEach(() => {
    window.sessionStorage.clear();
    tokenStorage.setAccessToken("token-123");
    tokenStorage.setAuthIdentity({ id: "56", role: "courier" });
    store.dispatch(setAppInitializing(false));
    seen.length = 0;
    unsubscribe = store.subscribe(() => seen.push(store.getState().user.isAppInitializing));
    vi.spyOn(authClient, "get").mockResolvedValue({ data: { data: { id: "56", role: "courier", name: "Kuryer" } } });
  });

  afterEach(() => {
    unsubscribe();
    vi.restoreAllMocks();
    tokenStorage.clear();
    store.dispatch(removeRole());
    store.dispatch(setAppInitializing(false));
  });

  it("rol tiklangan bo'lsa — yuklanish holati umuman yoqilmaydi, profil olinadi", async () => {
    store.dispatch(setRole("courier"));
    seen.length = 0;

    await initAuth({ background: true });

    expect(authClient.get).toHaveBeenCalled();
    expect(seen).not.toContain(true);
    expect(store.getState().user.isAppInitializing).toBe(false);
  });

  it("oddiy ochilish — avvalgidek yuklanish holati yoqiladi va o'chadi", async () => {
    await initAuth();

    expect(seen).toContain(true);
    expect(store.getState().user.isAppInitializing).toBe(false);
  });
});
