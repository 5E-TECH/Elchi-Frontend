import { describe, expect, it } from "vitest";
import uzSms from "../../locales/uz/sms.json";
import ruSms from "../../locales/ru/sms.json";
import enSms from "../../locales/en/sms.json";
import uzGroups from "../../locales/uz/notificationGroups.json";
import ruGroups from "../../locales/ru/notificationGroups.json";
import enGroups from "../../locales/en/notificationGroups.json";
import uzNotifications from "../../locales/uz/notifications.json";
import ruNotifications from "../../locales/ru/notifications.json";
import enNotifications from "../../locales/en/notifications.json";

/**
 * BILDIRISHNOMALAR BO'LIMI (Telegram guruhlari, xabar yuborish, SMS) — TARJIMA QAMROVI.
 * Kalitlar to'plami uchala tilda AYNI (ko'plik qo'shimchalari `_one/_few/_many/_other` bitta kalit sanaladi),
 * qiymat bo'sh emas (o'zbekcha birlik qo'shimchasi «ta» ingliz tilida yo'q — oqlangan istisnolar), ruschada kirill.
 * `notifications.json` dan faqat `dispatch.*` (qolgani — account bo'limi).
 */

type Tree = { [key: string]: string | Tree };

const flatten = (tree: Tree, prefix = ""): Record<string, string> =>
  Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") acc[path.replace(/_(zero|one|two|few|many|other)$/, "")] = value;
    else Object.assign(acc, flatten(value, path));
    return acc;
  }, {});

const CASES = [
  ["sms", uzSms, ruSms, enSms],
  ["notificationGroups", uzGroups, ruGroups, enGroups],
  [
    "notifications.dispatch",
    (uzNotifications as unknown as Tree).dispatch,
    (ruNotifications as unknown as Tree).dispatch,
    (enNotifications as unknown as Tree).dispatch,
  ],
] as const;

/** Ataylab bo'sh: ingliz tilida sanoq birligi yo'q («2 700» — «2 700 ta» emas). */
const EMPTY_OK = new Set(["report.unitCount"]);
/** Ruschada ham lotin: texnik nomlar, sof interpolatsiya, provayder nomlari. */
const RU_LATIN_OK = new Set([
  "pageTitle",
  "open",
  "count",
  "meter.chars",
  "settings.quietHours",
  "settings.usedToday",
  "settings.loginPlaceholder",
  "settings.senderPlaceholder",
  "settings.profileOtp",
  "settings.providers.eskiz",
  "settings.providers.playmobile",
  "campaign.confirmPartsValue",
  "templates.approved",
  "channel.telegram",
  "channel.sms",
  "channel.push",
  "linkPlaceholder",
  "confirmSingle",
  "counter",
  "sentChannels",
]);

describe("⭐ bildirishnomalar i18n — uch til teng", () => {
  for (const [name, uz, ru, en] of CASES) {
    const UZ = flatten(uz as Tree);
    const RU = flatten(ru as Tree);
    const EN = flatten(en as Tree);

    it(`${name}: kalitlar to'plami AYNI`, () => {
      const keys = Object.keys(UZ).sort();
      expect(keys.length).toBeGreaterThan(20);
      expect(Object.keys(RU).sort(), `${name}: ru`).toEqual(keys);
      expect(Object.keys(EN).sort(), `${name}: en`).toEqual(keys);
    });

    it(`${name}: qiymatlar bo'sh emas, ruschasi tarjima qilingan`, () => {
      for (const [lang, dict] of [
        ["uz", UZ],
        ["ru", RU],
        ["en", EN],
      ] as const) {
        for (const [key, value] of Object.entries(dict)) {
          if (lang === "en" && EMPTY_OK.has(key)) continue;
          expect(value.trim(), `${name}:${lang}:${key}`).not.toBe("");
        }
      }
      for (const [key, value] of Object.entries(RU)) {
        if (
          RU_LATIN_OK.has(key) ||
          /^[\s\d{}.,:·×–—/%()+-]*$/.test(value.replace(/\{\{\w+\}\}/g, ""))
        )
          continue;
        expect(/[Ѐ-ӿ]/.test(value), `${name}:ru:${key} = ${value}`).toBe(true);
      }
    });
  }
});
