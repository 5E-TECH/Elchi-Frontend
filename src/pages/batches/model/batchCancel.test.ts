import { describe, expect, it } from "vitest";
import type { Batch } from "../../../entities/batch";
import { mockRejection } from "../../../test/mockEnvelope";
import { canCancelBatch, resolveBatchCancelError } from "./batchCancel";

/**
 * Paketni bekor qilish (oP02jE2P): kim tugmani ko'radi va backend rad javobi qanday matnga aylanadi.
 * Backend: faqat PENDING (`new`), 409 `batch_in_transit`, 400 `batch_received` / `batch_already_cancelled` /
 * `batch_not_cancellable`, 403 — boshqa filial (FRONTEND_CHANGELOG 2026-11-17).
 */

const batch = (status: Batch["status"], sourceId = "7"): Pick<Batch, "status" | "from_branch"> => ({
  status,
  from_branch: { id: sourceId, name: "Urgut filiali" },
});

/** Backend konverti `{ statusCode, message, data: { reason, details } }` (gateway `publicErrorData`). */
const rejection = (status: number, message?: string, reason?: string) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: {
      status,
      data: {
        statusCode: status,
        ...(message ? { message } : {}),
        ...(reason ? { data: { reason, details: { batch_id: "172", status: "SENT" } } } : {}),
      },
    },
  });

describe("canCancelBatch — «Paketni bekor qilish» tugmasi", () => {
  it("faqat yangi (PENDING) paketda: yo'lda, qabul qilingan, bekor qilingan — hech kimga yo'q", () => {
    for (const role of ["superadmin", "admin", "manager", "registrator"]) {
      expect(canCancelBatch({ role, viewerBranchId: "7", batch: batch("new") })).toBe(true);
      for (const status of ["on_the_way", "received", "cancelled"] as const) {
        expect(canCancelBatch({ role, viewerBranchId: "7", batch: batch(status) }), `${role} · ${status}`).toBe(false);
      }
    }
  });

  it("superadmin va admin — istalgan filial paketi", () => {
    expect(canCancelBatch({ role: "superadmin", viewerBranchId: "", batch: batch("new", "99") })).toBe(true);
    expect(canCancelBatch({ role: "admin", viewerBranchId: "1", batch: batch("new", "99") })).toBe(true);
  });

  it("menejer / registrator / filial akkaunti — faqat manba filial; boshqa filial paketi — yo'q", () => {
    for (const role of ["manager", "registrator", "branch"]) {
      expect(canCancelBatch({ role, viewerBranchId: "7", batch: batch("new", "7") })).toBe(true);
      expect(canCancelBatch({ role, viewerBranchId: "1", batch: batch("new", "7") })).toBe(false);
    }
  });

  it("filial noma'lum (ko'ruvchida yoki paketda) — ko'rsatiladi, qarorni backend beradi (403)", () => {
    expect(canCancelBatch({ role: "manager", viewerBranchId: "", batch: batch("new", "7") })).toBe(true);
    expect(canCancelBatch({ role: "registrator", viewerBranchId: "7", batch: batch("new", "—") })).toBe(true);
  });

  it("boshqa rollar (logist, kuryer, market) va yuklanmagan paket — yo'q", () => {
    for (const role of ["logist", "courier", "market", "investor", null, undefined]) {
      expect(canCancelBatch({ role, viewerBranchId: "7", batch: batch("new", "7") })).toBe(false);
    }
    expect(canCancelBatch({ role: "superadmin", viewerBranchId: "", batch: null })).toBe(false);
  });
});

describe("resolveBatchCancelError — rad javobi", () => {
  it("409 batch_in_transit — «Paket yo'lda», qayta urinish yo'q", () => {
    expect(resolveBatchCancelError(rejection(409, "Paket yo'lda — jo'natilgan paketni bekor qilib bo'lmaydi", "batch_in_transit"))).toEqual({
      kind: "inTransit",
      message: null,
      blockConfirm: true,
    });
  });

  it("409 sababsiz (backend poygasi) — baribir «Paket yo'lda»", () => {
    expect(resolveBatchCancelError(rejection(409)).kind).toBe("inTransit");
  });

  it.each([
    ["batch_received", "received"],
    ["batch_already_cancelled", "alreadyCancelled"],
    ["batch_not_cancellable", "notCancellable"],
  ] as const)("400 %s — o'z matnimiz, tugma o'chadi", (reason, kind) => {
    expect(resolveBatchCancelError(rejection(400, "Qabul qilingan paketni bekor qilib bo'lmaydi", reason))).toEqual({
      kind,
      message: null,
      blockConfirm: true,
    });
  });

  it("403 — «ruxsatingiz yo'q» (backend «Transfer batch yaratishga …» matni emas), 404 — «topilmadi»", () => {
    expect(resolveBatchCancelError(rejection(403, "Transfer batch yaratishga ruxsat yo'q"))).toEqual({
      kind: "forbidden",
      message: null,
      blockConfirm: true,
    });
    expect(resolveBatchCancelError(rejection(404, "Partiya (transfer batch) topilmadi")).kind).toBe("notFound");
  });

  it("boshqa 4xx — backend o'zbekcha matni, holat kodisiz «(400)»; qayta urinish mumkin", () => {
    expect(resolveBatchCancelError(rejection(400, "Bekor qilish sababi kamida 10 ta belgidan iborat bo'lishi kerak"))).toEqual({
      kind: "rejected",
      message: "Bekor qilish sababi kamida 10 ta belgidan iborat bo'lishi kerak",
      blockConfirm: false,
    });
    expect(resolveBatchCancelError(rejection(400, "Paketni bekor qilib bo'lmaydi (400)")).message).toBe(
      "Paketni bekor qilib bo'lmaydi",
    );
    // Matnsiz 4xx — umumiy matn (komponent `cancel.errors.rejected`).
    expect(resolveBatchCancelError(rejection(422))).toEqual({ kind: "rejected", message: null, blockConfirm: false });
  });

  it("tarmoq / 5xx / backend hali deploy qilinmagan — umumiy xato, backend matni yo'q", () => {
    expect(resolveBatchCancelError(mockRejection(500))).toEqual({ kind: "failed", message: null, blockConfirm: false });
    expect(resolveBatchCancelError(mockRejection(502)).kind).toBe("failed");
    expect(resolveBatchCancelError(new Error("Network Error"))).toEqual({ kind: "failed", message: null, blockConfirm: false });
  });
});
