import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api: apiMock }));

import {
  getMySessions,
  normalizeAccountSession,
  normalizeAccountSessionList,
  normalizeRevokeSessionsResult,
  parseSessionTooNewError,
  revokeOtherSessions,
  revokeSession,
} from "./accountSessionApi";

/** `GET /auth/sessions` (Elchi Pochta #3) — faqat o'z sessiyalari (faol va `expired`). */
const row = (over: Record<string, unknown> = {}) => ({
  id: "6f1c2b0e-0000-4000-8000-000000000001",
  device_name: "Telefon · Android · Chrome",
  device_id: null,
  user_agent: "Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36",
  ip: "213.230.64.10",
  logged_in_at: "2026-10-21T04:12:00.000Z",
  first_logged_in_at: "2026-10-02T06:30:00.000Z",
  last_seen_at: "2026-10-21T09:48:00.000Z",
  expires_at: "2026-10-22T09:48:00.000Z",
  current: true,
  status: "active",
  ...over,
});

describe("normalizeAccountSession", () => {
  it("backend qatori — maydonlar o'z nomida, bo'sh satr `null`, `current` faqat `true` bo'lsa", () => {
    expect(normalizeAccountSession(row({ ip: "  ", device_id: "dev-1" }))).toEqual({
      id: "6f1c2b0e-0000-4000-8000-000000000001",
      device_name: "Telefon · Android · Chrome",
      device_id: "dev-1",
      user_agent: "Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36",
      ip: null,
      logged_in_at: "2026-10-21T04:12:00.000Z",
      first_logged_in_at: "2026-10-02T06:30:00.000Z",
      last_seen_at: "2026-10-21T09:48:00.000Z",
      expires_at: "2026-10-22T09:48:00.000Z",
      current: true,
      status: "active",
    });
    expect(normalizeAccountSession(row({ current: "true" }))?.current).toBe(false);
  });

  it("`status`: faqat `expired` — qayta kirish kerak; yo'q yoki boshqa qiymat (eski backend) — `active`", () => {
    expect(normalizeAccountSession(row({ status: "expired" }))?.status).toBe("expired");
    expect(normalizeAccountSession(row({ status: " EXPIRED " }))?.status).toBe("expired");
    expect(normalizeAccountSession(row({ status: "revoked" }))?.status).toBe("active");
    const legacy: Record<string, unknown> = row();
    delete legacy.status;
    delete legacy.first_logged_in_at;
    expect(normalizeAccountSession(legacy)).toMatchObject({ status: "active", first_logged_in_at: null });
  });

  it("`id` siz yoki ob'ekt bo'lmagan qator — `null`", () => {
    expect(normalizeAccountSession(row({ id: null }))).toBeNull();
    expect(normalizeAccountSession("x")).toBeNull();
    expect(normalizeAccountSession(null)).toBeNull();
  });
});

describe("normalizeAccountSessionList", () => {
  it("`{ statusCode, data: { active_count, sessions } }` — server tartibi saqlanadi", () => {
    const list = normalizeAccountSessionList({
      statusCode: 200,
      message: "success",
      data: { active_count: 3, sessions: [row({ id: "a", current: false }), row({ id: "b" }), { id: null }] },
    });
    expect(list.active_count).toBe(3);
    expect(list.sessions.map((session) => session.id)).toEqual(["a", "b"]);
  });

  it("`active_count` yo'q, noto'g'ri yoki ro'yxatdagi faollardan kichik — ro'yxatdagi faollar soni", () => {
    expect(normalizeAccountSessionList({ data: { sessions: [row()] } }).active_count).toBe(1);
    expect(normalizeAccountSessionList({ data: { active_count: "x", sessions: [row()] } }).active_count).toBe(1);
    expect(normalizeAccountSessionList({ data: { active_count: 0, sessions: [row(), row({ id: "b" })] } }).active_count).toBe(2);
  });

  it("`expired` qatorlar ro'yxatda, lekin `active_count` da sanalmaydi", () => {
    const list = normalizeAccountSessionList({
      data: { active_count: 1, sessions: [row({ id: "me" }), row({ id: "old", current: false, status: "expired" })] },
    });
    expect(list.active_count).toBe(1);
    expect(list.sessions.map((session) => [session.id, session.status])).toEqual([
      ["me", "active"],
      ["old", "expired"],
    ]);
    expect(normalizeAccountSessionList({ data: { sessions: [row({ status: "expired" })] } }).active_count).toBe(0);
  });

  it("boshqa shakl (bo'sh `data`, massiv, `null`) — bo'sh ro'yxat", () => {
    const empty = { active_count: 0, sessions: [], can_revoke_others: true, revoke_available_at: null };
    expect(normalizeAccountSessionList({ data: {} })).toEqual(empty);
    expect(normalizeAccountSessionList({ data: [] })).toEqual(empty);
    expect(normalizeAccountSessionList(null)).toEqual(empty);
  });

  it("yangi qurilma cheklovi: faqat aniq `false` — cheklov; yo'q / boshqa qiymat (eski backend) — ruxsat", () => {
    const at = "2026-10-25T09:30:00.000Z";
    expect(
      normalizeAccountSessionList({ data: { sessions: [row()], can_revoke_others: false, revoke_available_at: at } }),
    ).toMatchObject({ can_revoke_others: false, revoke_available_at: at });
    expect(normalizeAccountSessionList({ data: { sessions: [], can_revoke_others: "false" } })).toMatchObject({
      can_revoke_others: false,
      revoke_available_at: null,
    });
    expect(normalizeAccountSessionList({ data: { sessions: [], can_revoke_others: true } }).can_revoke_others).toBe(true);
    expect(normalizeAccountSessionList({ data: { sessions: [] } }).can_revoke_others).toBe(true);
    expect(normalizeAccountSessionList({ data: { sessions: [], can_revoke_others: null } }).can_revoke_others).toBe(true);
    // Yaroqsiz sana — `null`.
    expect(
      normalizeAccountSessionList({ data: { can_revoke_others: false, revoke_available_at: "ertaga" } }).revoke_available_at,
    ).toBeNull();
  });
});

describe("parseSessionTooNewError (403 SESSION_TOO_NEW)", () => {
  const at = "2026-10-25T09:30:00.000Z";
  const failed = (status: number, data: unknown) => ({ isAxiosError: true, response: { status, data } });

  it("maydonlar yuqori darajada — backend matni va `available_at`", () => {
    expect(
      parseSessionTooNewError(
        failed(403, {
          statusCode: 403,
          message: "Xavfsizlik uchun yangi qurilmadan boshqa sessiyalarni chiqarib bo'lmaydi — 25.10.2026, 14:30 dan keyin mumkin",
          code: "SESSION_TOO_NEW",
          available_at: at,
        }),
      ),
    ).toEqual({
      message: "Xavfsizlik uchun yangi qurilmadan boshqa sessiyalarni chiqarib bo'lmaydi — 25.10.2026, 14:30 dan keyin mumkin",
      available_at: at,
    });
  });

  it("maydonlar `data` / `details` / `error` ichida, `availableAt` — ham o'qiladi", () => {
    expect(parseSessionTooNewError(failed(403, { message: "Taqiq", data: { code: "SESSION_TOO_NEW", available_at: at } }))).toEqual({
      message: "Taqiq",
      available_at: at,
    });
    expect(parseSessionTooNewError(failed(403, { details: { code: "session_too_new", availableAt: at } }))).toEqual({
      message: null,
      available_at: at,
    });
    expect(parseSessionTooNewError(failed(403, { error: { code: "SESSION_TOO_NEW", message: "Ichki matn" } }))).toEqual({
      message: "Ichki matn",
      available_at: null,
    });
  });

  it("boshqa xato (kodsiz 403, 400, javobsiz, oddiy Error) — `null`", () => {
    expect(parseSessionTooNewError(failed(403, { statusCode: 403, message: "Forbidden" }))).toBeNull();
    expect(parseSessionTooNewError(failed(400, { message: "Joriy sessiya", code: "BAD_REQUEST" }))).toBeNull();
    expect(parseSessionTooNewError({ isAxiosError: true })).toBeNull();
    expect(parseSessionTooNewError(new Error("boom"))).toBeNull();
    expect(parseSessionTooNewError(null)).toBeNull();
  });
});

describe("getMySessions", () => {
  beforeEach(() => apiMock.get.mockReset());

  it("`GET auth/sessions` — parametrsiz, javob normallashtiriladi", async () => {
    apiMock.get.mockResolvedValue({ data: { statusCode: 200, data: { active_count: 1, sessions: [row()] } } });
    const list = await getMySessions();
    expect(apiMock.get).toHaveBeenCalledWith("auth/sessions");
    expect(list.sessions).toHaveLength(1);
  });
});

describe("sessiyalarni yopish", () => {
  beforeEach(() => {
    apiMock.delete.mockReset();
    apiMock.post.mockReset();
  });

  it("normalizeRevokeSessionsResult — `{ data: { revoked, session_ids } }`; `revoked` yo'q bo'lsa ID lar soni", () => {
    expect(
      normalizeRevokeSessionsResult({ statusCode: 200, message: "ok", data: { revoked: 2, session_ids: ["a", "b"] } }),
    ).toEqual({ revoked: 2, session_ids: ["a", "b"] });
    expect(normalizeRevokeSessionsResult({ data: { session_ids: ["a", " ", null, 7] } })).toEqual({
      revoked: 2,
      session_ids: ["a", "7"],
    });
    expect(normalizeRevokeSessionsResult({ data: { revoked: 0, session_ids: [] } })).toEqual({ revoked: 0, session_ids: [] });
    expect(normalizeRevokeSessionsResult(null)).toEqual({ revoked: 0, session_ids: [] });
  });

  it("revokeSession — `DELETE auth/sessions/:id` (ID kodlangan)", async () => {
    apiMock.delete.mockResolvedValue({ data: { statusCode: 200, data: { revoked: 1, session_ids: ["s/1"] } } });
    await expect(revokeSession("s/1")).resolves.toEqual({ revoked: 1, session_ids: ["s/1"] });
    expect(apiMock.delete).toHaveBeenCalledWith("auth/sessions/s%2F1");
  });

  it("revokeOtherSessions — `POST auth/sessions/revoke-others` tanasiz", async () => {
    apiMock.post.mockResolvedValue({ data: { statusCode: 200, data: { revoked: 0, session_ids: [] } } });
    await expect(revokeOtherSessions()).resolves.toEqual({ revoked: 0, session_ids: [] });
    expect(apiMock.post).toHaveBeenCalledWith("auth/sessions/revoke-others");
  });
});
