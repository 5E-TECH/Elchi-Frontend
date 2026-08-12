import { afterEach, beforeEach, describe, expect, it } from "vitest";
import reducer, {
  loginSuccess,
  setAccessToken,
  setLoading,
  setAppInitializing,
  setError,
  setProfile,
  logout,
} from "./slice";
import type { User } from "./types";

const base = () => reducer(undefined, { type: "@@INIT" });
const makeUser = (role: string, id = "1"): User => ({ id, role }) as unknown as User;

describe("userSlice reducer", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it("loginSuccess authenticates and persists token + role", () => {
    const user = makeUser("admin");
    const state = reducer(base(), loginSuccess({ accessToken: "tok", user }));

    expect(state.accessToken).toBe("tok");
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(user);
    expect(state.error).toBeNull();
    expect(window.localStorage.getItem("accessToken")).toBe("tok");
    expect(window.localStorage.getItem("role")).toBe("admin");
  });

  it("setAccessToken(token) authenticates and persists the token", () => {
    const state = reducer(base(), setAccessToken("abc"));

    expect(state.accessToken).toBe("abc");
    expect(state.isAuthenticated).toBe(true);
    expect(window.localStorage.getItem("accessToken")).toBe("abc");
  });

  it("setAccessToken(null) de-authenticates and clears storage", () => {
    window.localStorage.setItem("accessToken", "old");
    const state = reducer(base(), setAccessToken(null));

    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(window.localStorage.getItem("accessToken")).toBeNull();
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

  it("logout resets auth state and clears persisted token + role", () => {
    const authed = reducer(
      base(),
      loginSuccess({ accessToken: "tok", user: makeUser("admin") }),
    );
    const state = reducer(authed, logout());

    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(window.localStorage.getItem("accessToken")).toBeNull();
    expect(window.localStorage.getItem("role")).toBeNull();
  });
});
