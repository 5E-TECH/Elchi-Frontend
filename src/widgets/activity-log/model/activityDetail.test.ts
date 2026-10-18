import { describe, expect, it } from "vitest";
import type { ActivityLog } from "../../../entities/activity-log";
import { deviceFromUserAgent, hasActivityDetail, metadataRows } from "./activityDetail";

const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.100 Mobile Safari/537.36";
const WINDOWS_EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.2792.79";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const MAC_YANDEX =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 YaBrowser/24.7.0.0 Safari/537.36";

describe("deviceFromUserAgent", () => {
  it("OS · brauzer; Edge/Yandex satridagi «Chrome», iPhone satridagi «Mac OS X» chalg'itmaydi", () => {
    expect(deviceFromUserAgent(ANDROID_CHROME)).toBe("Android · Chrome");
    expect(deviceFromUserAgent(WINDOWS_EDGE)).toBe("Windows · Edge");
    expect(deviceFromUserAgent(IPHONE_SAFARI)).toBe("iPhone · Safari");
    expect(deviceFromUserAgent(MAC_YANDEX)).toBe("macOS · Yandex");
    expect(deviceFromUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0")).toBe("Linux · Firefox");
  });

  it("tanilmagan mijoz (ilova, skript) — null", () => {
    expect(deviceFromUserAgent("okhttp/4.12.0")).toBeNull();
    expect(deviceFromUserAgent("PostmanRuntime/7.39.0")).toBeNull();
  });
});

describe("metadataRows — «Qo'shimcha ma'lumot» (maket row-expanded)", () => {
  it("maket tartibi: Manba, Filial, boshqa kalitlar, Qurilma, IP manzil; `user_agent`/`device_id` alohida qator emas", () => {
    const rows = metadataRows({
      ip: "10.24.6.118",
      user_agent: ANDROID_CHROME,
      device_id: "3f1c9a2e-55b1-4b8e-9d0a-1f2e3d4c5b6a",
      device_name: "Android",
      reason: "Mijoz rad etdi",
      branch_name: "Toshkent HQ",
      source: "Kuryer ilovasi",
    });
    expect(rows.map((row) => row.key)).toEqual(["source", "branch_name", "reason", "device", "ip"]);
    expect(rows.find((row) => row.key === "device")).toEqual({ key: "device", value: "Android", title: ANDROID_CHROME });
    expect(rows.find((row) => row.key === "ip")?.value).toBe("10.24.6.118");
  });

  it("`device_name` bo'lmasa — `user_agent` dan qisqa nom; tanilmasa — xom satr", () => {
    expect(metadataRows({ user_agent: WINDOWS_EDGE }).find((row) => row.key === "device")?.value).toBe("Windows · Edge");
    expect(metadataRows({ user_agent: "okhttp/4.12.0" }).find((row) => row.key === "device")?.value).toBe("okhttp/4.12.0");
  });

  it("so'rov kontekstisiz yozuv (cron, bot, 30 kundan eski) — Qurilma va IP manzil bo'sh («—» ko'rsatiladi), sun'iy qiymat yo'q", () => {
    expect(metadataRows(null)).toEqual([
      { key: "device", value: null, title: undefined },
      { key: "ip", value: null },
    ]);
    expect(metadataRows({ leg: "courier", ip: "", device_name: "  " }).map((row) => [row.key, row.value])).toEqual([
      ["leg", "courier"],
      ["device", null],
      ["ip", null],
    ]);
  });

  it("«Filial» bir marta: `branch_name` bo'lsa `branch` qatori chiqmaydi", () => {
    expect(metadataRows({ branch: "3", branch_name: "Samarqand filiali" }).filter((row) => row.key.startsWith("branch"))).toEqual([
      { key: "branch_name", value: "Samarqand filiali" },
    ]);
    expect(metadataRows({ branch: "Urgut" }).filter((row) => row.key.startsWith("branch"))).toEqual([{ key: "branch", value: "Urgut" }]);
  });
});

describe("hasActivityDetail", () => {
  const base = { old_value: null, new_value: null, metadata: null, trace_id: null } as unknown as ActivityLog;

  it("faqat bo'sh qiymatli metadata — tafsilot yo'q (tugma chizilmaydi)", () => {
    expect(hasActivityDetail({ ...base, metadata: { operator_id: null, ip: "" } })).toBe(false);
    expect(hasActivityDetail(base)).toBe(false);
  });

  it("maydon o'zgarishi, to'ldirilgan metadata yoki kuzatuv ID — tafsilot bor", () => {
    expect(hasActivityDetail({ ...base, metadata: { ip: "10.0.0.1" } })).toBe(true);
    expect(hasActivityDetail({ ...base, old_value: { status: "new" }, new_value: { status: "sold" } })).toBe(true);
    expect(hasActivityDetail({ ...base, trace_id: "4f9c" })).toBe(true);
  });
});

describe("metadataRows — obyekt qiymatli qurilma", () => {
  it("`device` obyekt bo'lsa «[object Object]» emas, JSON", () => {
    expect(metadataRows({ device: { os: "Android" } }).find((row) => row.key === "device")?.value).toBe('{"os":"Android"}');
  });
});
