import { afterEach, describe, expect, it } from "vitest";
import { focusPageHeading } from "./focus";

describe("focusPageHeading", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("fokus `main h1` ga (tabindex=-1 bilan, Tab tartibiga qo'shilmaydi)", () => {
    document.body.innerHTML = "<h1>Tashqi</h1><main><h1>Bosh sahifa</h1></main>";
    expect(focusPageHeading()).toBe(true);
    expect(document.activeElement).toHaveTextContent("Bosh sahifa");
    expect(document.activeElement).toHaveAttribute("tabindex", "-1");
  });

  it("sarlavha yo'q — hech narsa qilmaydi", () => {
    expect(focusPageHeading()).toBe(false);
  });
});
