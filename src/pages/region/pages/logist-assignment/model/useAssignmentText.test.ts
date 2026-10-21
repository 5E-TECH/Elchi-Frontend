import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLogistBadgeText } from "./useAssignmentText";

describe("useLogistBadgeText", () => {
  it("funksiya qayta chizishda o'zgarmaydi (`LogistPicker` `useMemo` har safar qayta hisoblanmasin)", () => {
    const { result, rerender } = renderHook(() => useLogistBadgeText());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(first({ id: "1", name: "A", phone_number: "", status: "inactive" }, 3)).toBe("Nofaol");
  });
});
