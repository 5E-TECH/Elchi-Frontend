import { describe, expect, it } from "vitest";
import { Store, Truck, User } from "lucide-react";
import { getRoleAvatarConfig } from "./roleAvatar";

describe("getRoleAvatarConfig", () => {
  it("uses the user icon only for admin among operational roles", () => {
    expect(getRoleAvatarConfig("admin").icon).toBe(User);
    expect(getRoleAvatarConfig("courier").icon).toBe(Truck);
    expect(getRoleAvatarConfig("market").icon).toBe(Store);
  });

  it("normalizes backend role casing", () => {
    expect(getRoleAvatarConfig(" COURIER ").icon).toBe(Truck);
  });
});
