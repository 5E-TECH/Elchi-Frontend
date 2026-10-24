import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import store from "../app/config/store";
import { loginSuccess } from "../entities/user/model/slice";
import {
  authClient,
  logout,
  logoutAndRedirect,
  registerBeforeLogout,
  resetRevokedLogoutForTests,
} from "./authService";
import { clearLoginNotice, peekLoginNoticeDetails } from "./loginNotice";
import {
  handleSessionRevokedEvent,
  handleSessionRevokedSocketError,
  isSessionRevokedSocketError,
  SESSION_REVOKED_EVENT,
} from "./sessionRevoked";
import tokenStorage from "./tokenStorage";

const SID = "7f3c2a10-5b6d-4e8f-9a01-23456789abcd";
const OTHER_SID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

const base64url = (value: unknown) =>
  window.btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/** Gateway access token shakli: `{ sub, roles, sid }` (imzo tekshirilmaydi — faqat payload o'qiladi). */
const tokenWith = (claims: Record<string, unknown>) =>
  `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url({ sub: "56", roles: ["courier"], ...claims })}.signature`;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("auth:session_revoked — boshqa qurilmadan yopilgan sessiya joyida chiqadi (Elchi Pochta #3)", () => {
  let replace: ReturnType<typeof vi.fn>;
  let post: MockInstance<typeof authClient.post>;
  let hook: ReturnType<typeof vi.fn<(accessToken: string | null) => Promise<unknown>>>;
  let unregisterHook: () => void;

  const signIn = (token: string) => {
    tokenStorage.setAccessToken(token);
    tokenStorage.setSessionMetadata({ refreshTokenExpiresAt: Date.now() + 3_600_000 });
    tokenStorage.setAuthIdentity({ id: "56", role: "courier" });
    store.dispatch(loginSuccess({ accessToken: token }));
  };

  beforeEach(() => {
    window.sessionStorage.clear();
    resetRevokedLogoutForTests();
    replace = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, replace } as Location);
    post = vi.spyOn(authClient, "post").mockResolvedValue({ data: {} });
    hook = vi.fn<(accessToken: string | null) => Promise<unknown>>().mockResolvedValue(undefined);
    unregisterHook = registerBeforeLogout(hook);
    signIn(tokenWith({ sid: SID }));
  });

  afterEach(() => {
    unregisterHook();
    vi.restoreAllMocks();
    resetRevokedLogoutForTests();
    window.sessionStorage.clear();
  });

  it("hodisa nomi — backend kontrakti", () => {
    expect(SESSION_REVOKED_EVENT).toBe("auth:session_revoked");
  });

  it("⭐ mos `session_id` → joyida chiqish: token/metama'lumot/rol tozalanadi, «yopildi» xabari, /login; POST auth/logout YO'Q", async () => {
    expect(handleSessionRevokedEvent({ session_id: SID, reason: "revoked_by_owner" })).toBe(true);

    // Sinxron: token darhol tozalanadi (keyingi so'rovlar yopilgan sessiya bilan ketmaydi), React /login ga o'tadi.
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getSessionMetadata().refreshTokenExpiresAt).toBeNull();
    expect(tokenStorage.getAuthIdentity()).toEqual({ id: null, role: null });
    expect(store.getState().user.isAuthenticated).toBe(false);
    expect(store.getState().user.accessToken).toBeNull();
    expect(peekLoginNoticeDetails()).toMatchObject({
      notice: "sessionExpired",
      revoked: true,
      revokedReason: "revoked_by_owner",
    });

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    // Sessiya serverda allaqachon yopilgan — ortiqcha 401 va aylanma yo'q.
    expect(post).not.toHaveBeenCalled();
    // Push obunasi qurilmadan o'chadi, lekin serverga yopilgan token bilan so'rov yo'q (hook `null` token oladi).
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledWith(null);
    // Qayta yuklangach token yangilanmaydi (`initAuth` refresh qilmaydi).
    expect(window.sessionStorage.getItem("elchi_skip_refresh_once")).not.toBeNull();
  });

  it("`session_id` katta harfda kelsa ham mos (backend kichik harfga keltiradi)", async () => {
    expect(handleSessionRevokedEvent({ session_id: SID.toUpperCase(), reason: "security_reset" })).toBe(true);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
  });

  it("⭐ boshqa sessiya hodisasi — e'tiborsiz: token joyida, yo'naltirish yo'q", async () => {
    expect(handleSessionRevokedEvent({ session_id: OTHER_SID, reason: "revoked_by_owner" })).toBe(false);
    await flush();

    expect(tokenStorage.getAccessToken()).not.toBeNull();
    expect(store.getState().user.isAuthenticated).toBe(true);
    expect(replace).not.toHaveBeenCalled();
    expect(hook).not.toHaveBeenCalled();
    expect(peekLoginNoticeDetails()).toBeNull();
  });

  it("`sid` siz token (Telegram, eski) — hodisa e'tiborsiz", async () => {
    signIn(tokenWith({}));

    expect(handleSessionRevokedEvent({ session_id: SID, reason: "revoked_by_owner" })).toBe(false);
    await flush();
    expect(replace).not.toHaveBeenCalled();
  });

  it("buzilgan payload — e'tiborsiz", async () => {
    expect(handleSessionRevokedEvent(null)).toBe(false);
    expect(handleSessionRevokedEvent("revoked")).toBe(false);
    expect(handleSessionRevokedEvent({})).toBe(false);
    expect(handleSessionRevokedEvent({ session_id: 42 })).toBe(false);
    await flush();
    expect(replace).not.toHaveBeenCalled();
  });

  it("⭐ bir marta: hodisa ikki marta + ulanish xatosi + HTTP zaxira yo'li — bitta chiqish, bitta yo'naltirish", async () => {
    expect(handleSessionRevokedEvent({ session_id: SID, reason: "revoked_by_owner" })).toBe(true);
    // Token allaqachon tozalangan — keyingilari chiqishni qayta boshlamaydi.
    expect(handleSessionRevokedEvent({ session_id: SID, reason: "revoked_by_owner" })).toBe(false);
    expect(handleSessionRevokedSocketError({ message: "Session revoked", code: "SESSION_REVOKED" })).toBe(false);
    // Parallel so'rovning 401 → refresh 401 yo'li ham shu chiqishni kutadi: POST auth/logout va qayta yozish yo'q.
    await logoutAndRedirect({ reason: "sessionExpired", revoked: true });

    await vi.waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    await flush();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
    expect(peekLoginNoticeDetails()).toMatchObject({ revoked: true, revokedReason: "revoked_by_owner" });
  });

  it("⭐ `password_changed` → xabarda sabab saqlanadi («Parol almashtirildi» matni)", async () => {
    handleSessionRevokedEvent({ session_id: SID, reason: "password_changed" });

    expect(peekLoginNoticeDetails()).toMatchObject({
      notice: "sessionExpired",
      revoked: true,
      revokedReason: "password_changed",
    });
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("noma'lum sabab — umumiy «boshqa qurilmadan yopildi»", () => {
    handleSessionRevokedEvent({ session_id: SID, reason: "something_new" });

    const details = peekLoginNoticeDetails();
    expect(details).toMatchObject({ notice: "sessionExpired", revoked: true });
    expect(details?.revokedReason).toBeUndefined();
  });

  it("xabar sahifa qayta yuklanguncha o'chmaydi (React /login ga o'tib, kirish sahifasi uni o'chirmoqchi bo'lsa ham)", () => {
    handleSessionRevokedEvent({ session_id: SID, reason: "logout" });

    clearLoginNotice();

    expect(peekLoginNoticeDetails()).toMatchObject({ notice: "sessionExpired", revoked: true, revokedReason: "logout" });
  });

  it("⭐ shu tabning o'z «Chiqish» i paytida kelgan hodisa — socket yopiladi, lekin «boshqa qurilmadan yopildi» deyilmaydi", async () => {
    let finishPost: () => void = () => undefined;
    post.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishPost = () => resolve({ data: {} });
        }),
    );

    const ownLogout = logout();
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    // Server shu sessiyani yopdi va hodisani shu tabga ham yubordi.
    expect(handleSessionRevokedEvent({ session_id: SID, reason: "logout" })).toBe(true);
    finishPost();
    await ownLogout;

    expect(peekLoginNoticeDetails()).toBeNull();
    expect(post).toHaveBeenCalledTimes(1);
    // O'z chiqishidan keyin kelgan hodisa — token yo'q, e'tiborsiz.
    expect(handleSessionRevokedEvent({ session_id: SID, reason: "logout" })).toBe(false);
    await flush();
    expect(replace).not.toHaveBeenCalled();
  });

  describe("ulanish rad etildi (yopilgan sessiya tokeni bilan qayta ulanish)", () => {
    it("⭐ `connect_error` «Session revoked» → joyida chiqish, POST auth/logout yo'q", async () => {
      const error = Object.assign(new Error("Session revoked"), { data: { code: "SESSION_REVOKED" } });

      expect(handleSessionRevokedSocketError(error)).toBe(true);

      expect(tokenStorage.getAccessToken()).toBeNull();
      expect(peekLoginNoticeDetails()).toMatchObject({ notice: "sessionExpired", revoked: true });
      await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
      expect(post).not.toHaveBeenCalled();
    });

    it("server `error` hodisasi `{ code: 'SESSION_REVOKED' }` → chiqish", async () => {
      expect(handleSessionRevokedSocketError({ message: "Session revoked", code: "SESSION_REVOKED" })).toBe(true);
      await vi.waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    });

    it("oddiy `Unauthorized` (muddati o'tgan token) va tarmoq xatosi — chiqish YO'Q (HTTP zaxira yo'li hal qiladi)", async () => {
      expect(handleSessionRevokedSocketError({ message: "Unauthorized", code: "UNAUTHORIZED" })).toBe(false);
      expect(handleSessionRevokedSocketError(new Error("xhr poll error"))).toBe(false);
      expect(handleSessionRevokedSocketError(new Error("websocket error"))).toBe(false);
      await flush();
      expect(replace).not.toHaveBeenCalled();
      expect(tokenStorage.getAccessToken()).not.toBeNull();
    });

    it("`sid` siz token — sessiya tekshirilmaydi, chiqish yo'q", async () => {
      signIn(tokenWith({}));
      expect(handleSessionRevokedSocketError({ message: "Session revoked", code: "SESSION_REVOKED" })).toBe(false);
      await flush();
      expect(replace).not.toHaveBeenCalled();
    });
  });

  it("isSessionRevokedSocketError — `code` / `message` / `data` ichida, satr ham", () => {
    expect(isSessionRevokedSocketError("SESSION_REVOKED")).toBe(true);
    expect(isSessionRevokedSocketError({ message: "session revoked" })).toBe(true);
    expect(isSessionRevokedSocketError({ message: "x", data: { statusCode: 401, message: "Session revoked" } })).toBe(true);
    expect(isSessionRevokedSocketError({ message: "x", data: { error: { code: "SESSION_REVOKED" } } })).toBe(false);
    expect(isSessionRevokedSocketError({ statusCode: 401, message: "Unauthorized" })).toBe(false);
    expect(isSessionRevokedSocketError(undefined)).toBe(false);
    const circular: Record<string, unknown> = { message: "x" };
    circular.data = { data: circular };
    expect(isSessionRevokedSocketError(circular)).toBe(false);
  });
});
