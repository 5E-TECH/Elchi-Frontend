import type { BrowserContext } from "@playwright/test";
import { FIXED_NOW_MS } from "./stabilize";

/**
 * Vizual snapshotlar — sessiya va profil (`design/tools/app-shot.mjs` bilan bir xil kalitlar).
 * Sessiya sinov tokeni bilan ochiladi, hech qachon haqiqiy akkaunt yoki parol ishlatilmaydi.
 */
export type Theme = "light" | "dark";
export type Role = "superadmin" | "admin" | "manager" | "registrator" | "market" | "courier";
export type BranchType = "HQ" | "REGIONAL" | "HYBRID" | "PICKUP";

/** Rol → sukut filial turi (maketdagi persona menyusi; `app-shot.mjs` bilan bir xil). */
export const DEFAULT_BRANCH_TYPE: Partial<Record<Role, BranchType>> = {
  manager: "HYBRID",
  registrator: "HQ",
  courier: "REGIONAL",
};

/** Sintetik personalar — real ma'lumot emas. */
const PERSONA: Record<Role, { id: string; name: string; phone: string }> = {
  superadmin: { id: "1", name: "Aliyev Vali", phone: "+998901112233" },
  admin: { id: "2", name: "Karimova Dilnoza", phone: "+998901112244" },
  manager: { id: "3", name: "Rahimov Bekzod", phone: "+998901112255" },
  registrator: { id: "4", name: "Toshpo'latova Madina", phone: "+998901112266" },
  market: { id: "5", name: "Ipak Yo'li Savdo", phone: "+998901112277" },
  courier: { id: "6", name: "Yusupov Jasur", phone: "+998901112288" },
};

const BRANCH_NAME: Record<BranchType, string> = {
  HQ: "Toshkent HQ",
  REGIONAL: "Samarqand filiali",
  HYBRID: "Farg'ona filiali",
  PICKUP: "Chilonzor topshirish punkti",
};

/** Sessiya muddati — doimiy (muzlatilgan soatdan 1 kun keyin), `Date.now()` emas. */
const SESSION_EXPIRES_AT = FIXED_NOW_MS + 86_400_000;

/** `GET auth/my-profile` javobi: rol, filial va mavzu (server qiymati kirgach ustun — sessiya bilan bir xil). */
export const profileFor = (role: Role, theme: Theme, branchType: BranchType | null = DEFAULT_BRANCH_TYPE[role] ?? null) => {
  const persona = PERSONA[role];
  return {
    statusCode: 200,
    data: {
      id: persona.id,
      role,
      name: persona.name,
      phone_number: persona.phone,
      status: "active",
      settings: { appearance: { theme, themeChosen: true, language: "uz" } },
      ...(branchType
        ? {
            branch_id: "11",
            branch_type: branchType,
            branch: { id: "11", name: BRANCH_NAME[branchType], type: branchType, branch_type: branchType, region_id: "1" },
          }
        : {}),
    },
  };
};

/**
 * Brauzer xotirasi: sessiya (`accessToken`, `authSessionMetadata`, `role`) va mavzu/til. `role: null` —
 * mehmon (`/login`), sessiya yozilmaydi.
 */
export const installSession = async (context: BrowserContext, { role, theme }: { role: Role | null; theme: Theme }) => {
  await context.addInitScript(
    ({ role: sessionRole, theme: sessionTheme, expiresAt }) => {
      try {
        if (sessionRole) {
          sessionStorage.setItem("accessToken", "visual.local.token");
          sessionStorage.setItem(
            "authSessionMetadata",
            JSON.stringify({ accessTokenExpiresAt: expiresAt, refreshTokenExpiresAt: expiresAt, refreshTokenWarnAt: expiresAt }),
          );
          sessionStorage.setItem("role", sessionRole);
        }
        localStorage.setItem("theme", sessionTheme);
        localStorage.setItem("theme-version", "2");
        localStorage.setItem("app-language", "uz");
      } catch {
        /* saqlash yopiq bo'lsa ham sahifa ochiladi — test o'zi yiqiladi */
      }
    },
    { role, theme, expiresAt: SESSION_EXPIRES_AT },
  );
};
