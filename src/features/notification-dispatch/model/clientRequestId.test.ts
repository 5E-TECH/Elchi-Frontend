import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CLIENT_REQUEST_ID_RE,
  createDispatchAttempts,
  dispatchFingerprint,
  newClientRequestId,
} from "./clientRequestId";
import type { DispatchPayload } from "./schema";

const PAYLOAD: DispatchPayload = {
  type: "system.manual",
  title: "Ish vaqti",
  category: "system",
  priority: "normal",
  group_key: "xabar-20261018-120000",
  channels: ["in_app", "realtime"],
  broadcast: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("newClientRequestId", () => {
  it("returns a lowercase UUID the backend accepts", () => {
    const first = newClientRequestId();
    expect(first).toMatch(CLIENT_REQUEST_ID_RE);
    expect(newClientRequestId()).not.toBe(first);
  });

  it("falls back to getRandomValues (no randomUUID outside https) and still returns a v4 UUID", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0xff);
        return bytes;
      },
    });
    expect(newClientRequestId()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  });

  it("falls back to Math.random without any crypto API", () => {
    vi.stubGlobal("crypto", undefined);
    const id = newClientRequestId();
    expect(id).toMatch(CLIENT_REQUEST_ID_RE);
    expect(id[14]).toBe("4");
  });
});

describe("createDispatchAttempts", () => {
  it("keeps one id per message until it is settled; another message gets its own id", () => {
    const attempts = createDispatchAttempts();
    const a = dispatchFingerprint(PAYLOAD);
    const b = dispatchFingerprint({ ...PAYLOAD, title: "Boshqa" });

    const idA = attempts.take(a);
    expect(attempts.take(a)).toBe(idA);
    const idB = attempts.take(b);
    expect(idB).not.toBe(idA);
    // A xato berdi, B yuborildi, keyin yana A — A o'z id'si bilan.
    expect(attempts.take(a)).toBe(idA);

    attempts.settle(a);
    expect(attempts.take(a)).not.toBe(idA);
    expect(attempts.take(b)).toBe(idB);

    attempts.clear();
    expect(attempts.take(b)).not.toBe(idB);
  });

  it("the fingerprint ignores client_request_id itself", () => {
    expect(dispatchFingerprint({ ...PAYLOAD, client_request_id: newClientRequestId() })).toBe(
      dispatchFingerprint(PAYLOAD),
    );
  });
});
