import { describe, expect, it } from "vitest";
import { buildCreateMarketOperatorPayload } from "./createMarketOperator";

describe("buildCreateMarketOperatorPayload", () => {
  it("normalizes operator data without accepting a client-controlled market id", () => {
    expect(
      buildCreateMarketOperatorPayload({
        name: "  Ali   Valiyev  ",
        phone_number: "+998 90 123 45 67",
        password: "secret123",
      }),
    ).toEqual({
      name: "Ali Valiyev",
      phone_number: "+998901234567",
      password: "secret123",
    });
  });
});
