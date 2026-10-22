import { expect } from "vitest";

/**
 * OPS (va boshqa) sahifa testlari uchun — HAQIQIY backend javob shakli (Trello LJt0G1y1).
 *
 * Ops testlari ilgari `api.get` ni `{ data: [] }` yoki yalang'och massiv bilan mocklagan: jonli backend esa
 * `{ statusCode, message, data }` konvertini qaytaradi va sahifalar shu farq tufayli P0 xato bilan yiqilgan
 * («te.some is not a function»). Endi har ops testi javobni shu yordamchilar orqali yasaydi:
 *
 *   apiGetMock.mockResolvedValue(mockEnvelope({ items: [...], meta: { total: 1 } }));   // axios javobi
 *   apiPostMock.mockRejectedValue(mockRejection(400));                                   // rad etilgan so'rov
 *   expectNoRawBackendText();                                                            // xom matn chiqmadi
 *   expectRequestBody(apiPostMock, "investors", { name: "Ali", phone_number: "+998…" }); // POST tanasi
 *
 * `src/test/opsPageTests.test.ts` har `src/pages/*-ops` sahifasi testlarida shularni talab qiladi.
 */

export type Envelope<T> = { statusCode: number; message: string; data: T };

/**
 * axios javobi (`res`): `res.data` — backend konverti `{ statusCode, message, data }`.
 * `mockEnvelope([])` → `{ data: { statusCode: 200, message: "OK", data: [] } }`.
 */
export const mockEnvelope = <T>(
  data: T,
  { statusCode = 200, message = "OK" }: { statusCode?: number; message?: string } = {},
): { data: Envelope<T> } => ({ data: { statusCode, message, data } });

/**
 * Rad etilgan so'rovdagi backend matni — ataylab xom (inglizcha class-validator uslubida) va noyob: test u
 * ekranda YO'QLIGINI tekshiradi (`expectNoRawBackendText`).
 */
export const RAW_BACKEND_MESSAGE = "RAW_BACKEND_TEXT: property must be a string; internal stack at handler.ts:42";

/** axios xatosi shaklidagi rad javobi (`isAxiosError`, `response.status`, konvert `{ statusCode, message, error }`). */
export const mockRejection = (status: number, message: string | string[] = RAW_BACKEND_MESSAGE) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    code: status >= 500 ? "ERR_BAD_RESPONSE" : "ERR_BAD_REQUEST",
    response: { status, data: { statusCode: status, message, error: "Bad Request" } },
  });

/** Ekranda (sukut — butun hujjat) backend xom matni yo'q. */
export const expectNoRawBackendText = (root: HTMLElement = document.body) => {
  expect(root.textContent ?? "").not.toContain("RAW_BACKEND_TEXT");
  expect(root.textContent ?? "").not.toContain("handler.ts");
};

type CallMock = { mock: { calls: unknown[][] } };

/** `url` ga ketgan so'rov tanasi aynan `body` (faqat URL emas — tana shakli ham, LJt0G1y1 «951956»). */
export const expectRequestBody = (mock: CallMock, url: string, body: unknown) => {
  const calls = mock.mock.calls.filter(([calledUrl]) => calledUrl === url);
  expect(calls.length, `${url} ga so'rov ketmadi`).toBeGreaterThan(0);
  expect(calls.at(-1)![1]).toEqual(body);
};
