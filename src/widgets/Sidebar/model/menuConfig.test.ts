import { describe, expect, it } from "vitest";
import {
  getSidebarConfigForUser,
  normalizeSidebarRole,
  type BranchType,
} from "./menuConfig";

const userWithBranchType = (type: BranchType) =>
  ({
    branch: { type },
  }) as never;

describe("sidebar menu config", () => {
  it("does not expose legacy operator as an app role", () => {
    expect(normalizeSidebarRole("operator")).toBeNull();
    expect(getSidebarConfigForUser("operator")).toEqual([]);
  });

  it("keeps manager menu scoped by branch type", () => {
    expect(getSidebarConfigForUser("manager").map((item) => item.to)).toEqual([
      "/branch-dashboard",
      "/orders",
      "/regions",
    ]);

    expect(getSidebarConfigForUser("manager", userWithBranchType("REGIONAL")).map((item) => item.to)).toEqual([
      "/branch-dashboard",
      "/dispatch",
      "/orders",
      "/mails",
      "/all-users",
      "/payments",
      "/regions",
    ]);

    expect(getSidebarConfigForUser("manager", userWithBranchType("PICKUP")).map((item) => item.to)).toEqual([
      "/branch-dashboard",
      "/orders",
      "/new-orders",
      "/batches",
      "/returns",
      "/regions",
    ]);

    expect(getSidebarConfigForUser("manager", userWithBranchType("HQ")).map((item) => item.to)).toEqual([
      "/branch-dashboard",
      "/orders",
      "/mails",
      "/payments",
      "/regions",
    ]);
  });
});
