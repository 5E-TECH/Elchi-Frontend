import { afterEach, describe, expect, it } from "vitest";
import { inertOthers } from "./inert";
import { getPortalRoot, LAYER_ATTR } from "./portalRoot";

/** inertOthers: body bolalari va boshqa qatlamlar inert, xabar qatlami va o'zi emas; hisoblagich. */

const make = (parent: HTMLElement, attrs: Record<string, string> = {}) => {
  const el = document.createElement("div");
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  parent.appendChild(el);
  return el;
};

describe("inertOthers", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("oynadan tashqarini inert qiladi; toast va o'z konteyneri — yo'q; tiklanadi", () => {
    const app = make(document.body, { id: "root" });
    const legacy = make(document.body);
    const portal = getPortalRoot();
    const toast = make(portal, { [LAYER_ATTR]: "toast" });
    const other = make(portal, { [LAYER_ATTR]: "dropdown" });
    const own = make(portal, { [LAYER_ATTR]: "overlay" });
    const panel = make(own);

    const restore = inertOthers(own);
    expect(app).toHaveAttribute("inert");
    expect(legacy).toHaveAttribute("inert");
    expect(other).toHaveAttribute("inert");
    expect(toast).not.toHaveAttribute("inert");
    expect(own).not.toHaveAttribute("inert");
    expect(panel).not.toHaveAttribute("inert");
    expect(portal).not.toHaveAttribute("inert");

    restore();
    for (const el of [app, legacy, other]) expect(el).not.toHaveAttribute("inert");
  });

  it("hisoblagich: ikki oyna — birinchisi yopilganda #root inert qoladi", () => {
    const app = make(document.body, { id: "root" });
    const portal = getPortalRoot();
    const a = make(portal, { [LAYER_ATTR]: "overlay" });
    const restoreA = inertOthers(a);
    const b = make(portal, { [LAYER_ATTR]: "overlay" });
    const restoreB = inertOthers(b);
    expect(a).toHaveAttribute("inert");
    restoreB();
    expect(a).not.toHaveAttribute("inert");
    expect(app).toHaveAttribute("inert");
    restoreA();
    expect(app).not.toHaveAttribute("inert");
  });

  it("oldindan inert bo'lgan elementga tegilmaydi", () => {
    const app = make(document.body, { id: "root", inert: "" });
    const own = make(getPortalRoot(), { [LAYER_ATTR]: "overlay" });
    const restore = inertOthers(own);
    restore();
    expect(app).toHaveAttribute("inert");
  });

  it("targets — faqat berilgan elementlar", () => {
    const app = make(document.body, { id: "root" });
    const legacy = make(document.body);
    const own = make(getPortalRoot(), { [LAYER_ATTR]: "overlay" });
    const restore = inertOthers(own, { targets: [app] });
    expect(app).toHaveAttribute("inert");
    expect(legacy).not.toHaveAttribute("inert");
    restore();
  });
});
