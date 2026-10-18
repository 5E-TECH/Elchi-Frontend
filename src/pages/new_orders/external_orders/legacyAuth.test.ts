import { describe, expect, it } from "vitest";
import {
  LEGACY_AUTH_TYPES,
  buildLegacyAuthCreate,
  buildLegacyAuthUpdate,
  legacyAuthLabelKey,
  toLegacyAuthType,
  type LegacyAuthForm,
} from "./legacyAuth";

const FORM: LegacyAuthForm = {
  auth_type: "login",
  auth_url: " https://api.example.uz/auth ",
  username: " elchi_sync ",
  password: " Parol123 ",
  token: " tok_123 ",
};

describe("eski manba avtorizatsiyasi — backend kontrakti (`login` | `api_key`)", () => {
  it("formada faqat backend qiymatlari", () => {
    expect(LEGACY_AUTH_TYPES).toEqual(["login", "api_key"]);
  });

  it("saqlangan va eski qiymatlar forma qiymatiga o'giriladi", () => {
    expect(toLegacyAuthType("login")).toBe("login");
    expect(toLegacyAuthType("basic")).toBe("login");
    expect(toLegacyAuthType("api_key")).toBe("api_key");
    expect(toLegacyAuthType("bearer")).toBe("api_key");
    expect(toLegacyAuthType("none")).toBe("api_key");
    expect(toLegacyAuthType(undefined)).toBe("api_key");
  });

  it("ro'yxat yorlig'i eski yozuvlar uchun ham to'g'ri", () => {
    expect(legacyAuthLabelKey("login")).toBe("legacySources.authBasic");
    expect(legacyAuthLabelKey("basic")).toBe("legacySources.authBasic");
    expect(legacyAuthLabelKey("api_key")).toBe("legacySources.authToken");
    expect(legacyAuthLabelKey("bearer")).toBe("legacySources.authToken");
    expect(legacyAuthLabelKey("none")).toBe("legacySources.authNone");
    expect(legacyAuthLabelKey("")).toBe("legacySources.authNone");
    expect(legacyAuthLabelKey("oauth")).toBeNull();
  });

  it("yaratish: login — credentials'da login/parol; token turida yo'q", () => {
    expect(buildLegacyAuthCreate(FORM)).toEqual({
      auth_type: "login",
      credentials: {
        auth_url: "https://api.example.uz/auth",
        username: "elchi_sync",
        password: "Parol123",
      },
    });
  });

  it("yaratish: token `credentials.api_key` da (backend kalitni faqat shu yerdan o'qiydi), `token` emas", () => {
    const payload = buildLegacyAuthCreate({ ...FORM, auth_type: "api_key" });
    expect(payload).toEqual({
      auth_type: "api_key",
      credentials: { auth_url: "https://api.example.uz/auth", api_key: "tok_123" },
    });
    expect(payload.credentials).not.toHaveProperty("token");
    expect(buildLegacyAuthCreate({ ...FORM, auth_type: "api_key", token: " " })).toEqual({
      auth_type: "api_key",
      credentials: { auth_url: "https://api.example.uz/auth" },
    });
  });

  it("tahrirlash: yassi maydonlar, `credentials` yo'q; bo'sh sir yuborilmaydi", () => {
    expect(buildLegacyAuthUpdate(FORM)).toEqual({
      auth_type: "login",
      auth_url: "https://api.example.uz/auth",
      username: "elchi_sync",
      password: "Parol123",
    });
    expect(buildLegacyAuthUpdate({ ...FORM, password: "" })).toEqual({
      auth_type: "login",
      auth_url: "https://api.example.uz/auth",
      username: "elchi_sync",
    });
    expect(buildLegacyAuthUpdate({ ...FORM, auth_type: "api_key", auth_url: "" })).toEqual({
      auth_type: "api_key",
      api_key: "tok_123",
    });
    expect(buildLegacyAuthUpdate({ ...FORM, auth_type: "api_key", token: "" })).not.toHaveProperty(
      "api_key",
    );
  });
});
