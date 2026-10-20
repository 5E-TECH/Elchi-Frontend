import { classifyDispatchError } from "./dispatchError";

const httpError = (status?: number) =>
  Object.assign(new Error("x"), { isAxiosError: true, response: status ? { status, data: { message: "raw" } } : undefined });

describe("classifyDispatchError", () => {
  it("no response and 502–504 — the outcome is unknown (never re-sent automatically)", () => {
    expect(classifyDispatchError(httpError())).toEqual({ kind: "unknown" });
    for (const status of [502, 503, 504]) expect(classifyDispatchError(httpError(status))).toEqual({ kind: "unknown" });
  });

  it("other statuses map to i18n keys, never to the backend message", () => {
    expect(classifyDispatchError(httpError(400))).toEqual({ kind: "error", messageKey: "dispatch.error.badRequest" });
    expect(classifyDispatchError(httpError(403))).toEqual({ kind: "error", messageKey: "dispatch.error.forbidden" });
    expect(classifyDispatchError(httpError(404))).toEqual({ kind: "error", messageKey: "dispatch.error.notFound" });
    expect(classifyDispatchError(httpError(429))).toEqual({ kind: "error", messageKey: "dispatch.error.tooMany" });
    expect(classifyDispatchError(httpError(500))).toEqual({ kind: "error", messageKey: "dispatch.error.server" });
    expect(classifyDispatchError(httpError(418))).toEqual({ kind: "error", messageKey: "dispatch.error.generic" });
  });
});
