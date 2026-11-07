import { describe, expect, it } from "vitest";
import reducer, {
  loginSuccess,
  setAccessToken,
  setLoading,
  setAppInitializing,
  setError,
  setProfile,
  setSessionRestore,
  logout,
} from "./slice";
import type { User } from "./types";

const base = () => reducer(undefined, { type: "@@INIT" });
const makeUser = (role: string, id = "1"): User => ({ id, role }) as unknown as User;

// The slice is a pure reducer: token persistence lives in `tokenStorage`
// (sessionStorage), so these assertions cover state transitions only.
describe("userSlice reducer", () => {
  it("loginSuccess authenticates and stores the token + user in state", () => {
    const user = makeUser("admin");
    const state = reducer(base(), loginSuccess({ accessToken: "tok", user }));

    expect(state.accessToken).toBe("tok");
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(user);
    expect(state.error).toBeNull();
    expect(state.loading).toBe(false);
  });

  it("loginSuccess keeps the existing user when none is provided", () => {
    const seeded = reducer(base(), setProfile(makeUser("manager", "9")));
    const state = reducer(seeded, loginSuccess({ accessToken: "tok" }));

    expect(state.accessToken).toBe("tok");
    expect(state.user).toEqual(makeUser("manager", "9"));
  });

  it("setAccessToken(token) authenticates", () => {
    const state = reducer(base(), setAccessToken("abc"));

    expect(state.accessToken).toBe("abc");
    expect(state.isAuthenticated).toBe(true);
  });

  it("setAccessToken(null) de-authenticates", () => {
    const authed = reducer(base(), setAccessToken("old"));
    const state = reducer(authed, setAccessToken(null));

    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("setProfile stores the user and marks authenticated", () => {
    const user = makeUser("manager", "2");
    const state = reducer(base(), setProfile(user));

    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(true);
  });

  it("setError clears loading and records the message", () => {
    const loading = reducer(base(), setLoading(true));
    const state = reducer(loading, setError("boom"));

    expect(state.loading).toBe(false);
    expect(state.error).toBe("boom");
  });

  it("setLoading and setAppInitializing toggle their flags", () => {
    expect(reducer(base(), setLoading(true)).loading).toBe(true);
    expect(reducer(base(), setAppInitializing(false)).isAppInitializing).toBe(false);
  });

  it("logout resets auth state", () => {
    const authed = reducer(
      base(),
      loginSuccess({ accessToken: "tok", user: makeUser("admin") }),
    );
    const state = reducer(authed, logout());

    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBeNull();
  });
});

// Sekin internet (2026-11-07): «Internet sekin — qayta urinilmoqda» ekrani holati.
describe("userSlice — sessionRestore", () => {
  it("boshlang'ich holatda yo'q; setSessionRestore qo'yadi va tozalaydi", () => {
    expect(base().sessionRestore).toBeNull();
    const shown = reducer(base(), setSessionRestore({ phase: "waiting", reason: "network" }));
    expect(shown.sessionRestore).toEqual({ phase: "waiting", reason: "network" });
    expect(reducer(shown, setSessionRestore(null)).sessionRestore).toBeNull();
  });

  it.each([
    ["loginSuccess", loginSuccess({ accessToken: "tok" })],
    ["logout", logout()],
  ])("%s ekranni yopadi", (_name, action) => {
    const shown = reducer(base(), setSessionRestore({ phase: "slow", reason: "network" }));
    expect(reducer(shown, action).sessionRestore).toBeNull();
  });
});
