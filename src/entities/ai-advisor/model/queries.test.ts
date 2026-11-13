import { QueryCache, QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../../shared/config/queryKeys";

const mocks = vi.hoisted(() => ({ getAiAccessMe: vi.fn() }));

vi.mock("../api/aiAssistantApi", () => ({
  getAiAccessMe: mocks.getAiAccessMe,
  getAiConversation: vi.fn(),
  getAiConversations: vi.fn(),
}));

import { refetchAiAccessMe } from "./queries";

afterEach(() => vi.clearAllMocks());

describe("refetchAiAccessMe", () => {
  it("xato global xabarsiz: so'rov `meta.silentError` bilan (ilovadagi QueryCache `onError` shu bo'yicha jim turadi)", async () => {
    const metas: unknown[] = [];
    const queryClient = new QueryClient({
      queryCache: new QueryCache({ onError: (_error, query) => metas.push(query.meta) }),
      defaultOptions: { queries: { retry: false } },
    });
    mocks.getAiAccessMe.mockRejectedValue(Object.assign(new Error("HTTP 429"), { response: { status: 429 } }));

    await expect(refetchAiAccessMe(queryClient)).rejects.toThrow("HTTP 429");
    expect(metas).toEqual([{ silentError: true }]);
    expect(queryClient.getQueryCache().find({ queryKey: queryKeys.aiAssistant.accessMe })?.meta).toEqual({ silentError: true });
  });
});
