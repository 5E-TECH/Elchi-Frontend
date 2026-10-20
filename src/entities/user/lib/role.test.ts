import { describe, expect, it } from "vitest";
import designRoles from "../../../../design/kit/roles.json";
import uz from "../../../locales/uz/users.json";
import ru from "../../../locales/ru/users.json";
import en from "../../../locales/en/users.json";
import {
  ROLE_PERSONA,
  USER_ROLE_LABEL_KEYS,
  getUserRoleLabelKey,
  isMarketSideRole,
  roleHasGlobalSearch,
  roleHasScanner,
} from "./role";

/**
 * Rol yorliqlari va personasi (ROL-0). Persona manbasi — maket `design/kit/roles.json` → `persona`.
 */

type Persona = { scan: boolean; search?: boolean };
const DESIGN = designRoles.roles as unknown as Record<string, { persona: Persona }>;

describe("rol yorliqlari", () => {
  it.each(["logist", "market_operator", "investor", "branch"])(
    "%s — o'z yorlig'i bor («Noma'lum» emas)",
    (role) => {
      expect(getUserRoleLabelKey(role)).not.toBe("roleUnknown");
    },
  );

  it("o'zbekcha nomlar: Logist, Market operatori, Investor, Filial", () => {
    expect(uz[getUserRoleLabelKey("logist") as keyof typeof uz]).toBe("Logist");
    expect(uz[getUserRoleLabelKey("market_operator") as keyof typeof uz]).toBe("Market operatori");
    expect(uz[getUserRoleLabelKey("investor") as keyof typeof uz]).toBe("Investor");
    expect(uz[getUserRoleLabelKey("branch") as keyof typeof uz]).toBe("Filial");
  });

  it("har yorliq kaliti uz/ru/en da bor va bo'sh emas", () => {
    for (const [name, locale] of Object.entries({ uz, ru, en })) {
      for (const key of [...Object.values(USER_ROLE_LABEL_KEYS), "roleUnknown"]) {
        const value = (locale as Record<string, unknown>)[key];
        expect(typeof value === "string" && value.trim().length > 0, `${name}.${key}`).toBe(true);
      }
    }
  });

  it("noma'lum yoki bo'sh rol — «Noma'lum»", () => {
    expect(getUserRoleLabelKey("pilot")).toBe("roleUnknown");
    expect(getUserRoleLabelKey(null)).toBe("roleUnknown");
  });
});

describe("rol personasi — maket roles.json → persona bilan bir xil", () => {
  it("maketdagi har rolning personasi kodda bor (va aksincha)", () => {
    expect(new Set(Object.keys(ROLE_PERSONA))).toEqual(new Set(Object.keys(DESIGN)));
  });

  it.each(Object.keys(DESIGN))("%s: skaner — persona.scan", (role) => {
    expect(roleHasScanner(role)).toBe(DESIGN[role].persona.scan);
  });

  it("skaner yo'q: market, market operatori, logist, investor", () => {
    const withoutScanner = Object.keys(DESIGN).filter((role) => !roleHasScanner(role));
    expect(withoutScanner.sort()).toEqual(["investor", "logist", "market", "market_operator"]);
  });

  it("global qidiruv: investordan boshqa hamma maket rolida (logist — persona.search, ega LG-S2)", () => {
    const withoutSearch = Object.keys(DESIGN).filter((role) => !roleHasGlobalSearch(role));
    expect(withoutSearch).toEqual(["investor"]);
    for (const role of Object.keys(DESIGN)) {
      if (DESIGN[role].persona.search === false) expect(roleHasGlobalSearch(role), role).toBe(false);
    }
    expect(roleHasGlobalSearch("logist")).toBe(true);
  });

  it("katta harf va bo'shliq farq qilmaydi; noma'lum rol — skanersiz va qidiruvsiz", () => {
    expect(roleHasScanner(" Courier ")).toBe(true);
    expect(roleHasGlobalSearch("INVESTOR")).toBe(false);
    for (const role of ["operator", "customer", "", null, undefined, "toString", "__proto__"]) {
      expect(roleHasScanner(role), String(role)).toBe(false);
      expect(roleHasGlobalSearch(role), String(role)).toBe(false);
    }
  });
});

describe("isMarketSideRole", () => {
  it("market va market operatori — ha", () => {
    expect(isMarketSideRole("market")).toBe(true);
    expect(isMarketSideRole("market_operator")).toBe(true);
    expect(isMarketSideRole("MARKET_OPERATOR")).toBe(true);
  });

  it("boshqa rollar — yo'q", () => {
    for (const role of ["superadmin", "admin", "manager", "registrator", "courier", "logist", "investor", "marketing", null]) {
      expect(isMarketSideRole(role), String(role)).toBe(false);
    }
  });
});
