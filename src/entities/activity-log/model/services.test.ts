import { describe, expect, it } from "vitest";
import en from "../../../locales/en/activityLogs.json";
import ru from "../../../locales/ru/activityLogs.json";
import uz from "../../../locales/uz/activityLogs.json";
import { ACTIVITY_SERVICES } from "./types";

/**
 * `/activity-logs` xizmat oyoqlari — gateway `audit-gateway.controller.ts` bilan bir xil (BE-5 §11: oxirgi oyoq `ai`),
 * har birining uz/ru/en yorlig'i bor (filtr va «Xizmat» ustuni).
 */
describe("ACTIVITY_SERVICES", () => {
  it("gateway oyoqlari tartibida, AI maslahatchi (`ai`) bilan", () => {
    expect(ACTIVITY_SERVICES).toEqual([
      "identity",
      "order",
      "finance",
      "branch",
      "integration",
      "logistics",
      "catalog",
      "investor",
      "notification",
      "ai",
    ]);
  });

  it.each([
    ["uz", uz.services, "AI maslahatchi"],
    ["ru", ru.services, "AI-советник"],
    ["en", en.services, "AI advisor"],
  ] as const)("%s: har xizmatga yorliq, `ai` — «%s»", (_lng, services, aiLabel) => {
    expect(Object.keys(services).sort()).toEqual([...ACTIVITY_SERVICES].sort());
    expect(services.ai).toBe(aiLabel);
  });
});
