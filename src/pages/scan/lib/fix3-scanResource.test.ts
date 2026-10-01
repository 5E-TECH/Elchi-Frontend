import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("../../../shared/api/api", () => ({ api: apiMock }));

import { receiveScannedPackage } from "./scanResource";

/** fix3 CODE-15 — gateway `@Post('transfer-batches/:id/receive')`. */
describe("receiveScannedPackage", () => {
  beforeEach(() => {
    apiMock.post.mockReset().mockResolvedValue({ data: { statusCode: 200 } });
    apiMock.patch.mockReset();
  });

  it("POST bilan yuboradi (avval PATCH edi va doim 404 berardi)", async () => {
    await expect(receiveScannedPackage("41")).resolves.toEqual({ statusCode: 200 });

    expect(apiMock.post).toHaveBeenCalledWith("transfer-batches/41/receive");
    expect(apiMock.patch).not.toHaveBeenCalled();
  });
});
