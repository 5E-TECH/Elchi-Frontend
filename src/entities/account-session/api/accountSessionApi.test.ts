import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api: apiMock }));

import {
  getMySessions,
  normalizeAccountSession,
  normalizeAccountSessionList,
  normalizeRevokeSessionsResult,
  revokeOtherSessions,
  revokeSession,
} from "./accountSessionApi";

/** `GET /auth/sessions` (Elchi Pochta #3) — faqat o'z faol sessiyalari. */
const row = (over: Record<string, unknown> = {}) => ({
  id: "6f1c2b0e-0000-4000-8000-000000000001",
  device_name: "Telefon · Android · Chrome",
  device_id: null,
  user_agent: "Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36",
  ip: "213.230.64.10",
  logged_in_at: "2026-10-21T04:12:00.000Z",
  last_seen_at: "2026-10-21T09:48:00.000Z",
  expires_at: "2026-10-22T09:48:00.000Z",
  current: true,
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
      last_seen_at: "2026-10-21T09:48:00.000Z",
      expires_at: "2026-10-22T09:48:00.000Z",
      current: true,
    });
    expect(normalizeAccountSession(row({ current: "true" }))?.current).toBe(false);
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

  it("`active_count` yo'q, noto'g'ri yoki ro'yxatdan kichik — ro'yxat uzunligi", () => {
    expect(normalizeAccountSessionList({ data: { sessions: [row()] } }).active_count).toBe(1);
    expect(normalizeAccountSessionList({ data: { active_count: "x", sessions: [row()] } }).active_count).toBe(1);
    expect(normalizeAccountSessionList({ data: { active_count: 0, sessions: [row(), row({ id: "b" })] } }).active_count).toBe(2);
  });

  it("boshqa shakl (bo'sh `data`, massiv, `null`) — bo'sh ro'yxat", () => {
    expect(normalizeAccountSessionList({ data: {} })).toEqual({ active_count: 0, sessions: [] });
    expect(normalizeAccountSessionList({ data: [] })).toEqual({ active_count: 0, sessions: [] });
    expect(normalizeAccountSessionList(null)).toEqual({ active_count: 0, sessions: [] });
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
