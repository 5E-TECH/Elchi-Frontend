import { afterEach, describe, expect, it, vi } from "vitest";
import { ReceiptFontError } from "./printReceiptFonts";
import { printReceiptHtml } from "./printReceiptHtml";

/**
 * HJ5sLHiz — brauzer chop etishi (TZ F9): yashirin iframe, ichida skript yo'q; shriftlar yuklanmasa chop etilmaydi.
 * jsdom shrift yuklay olmaydi (`document.fonts` yo'q) — muvaffaqiyatli yo'l e2e da (FE-2); bu yerda iframe va xato yo'li.
 */

afterEach(() => vi.restoreAllMocks());

const frames = () => [...document.querySelectorAll("iframe")];

describe("printReceiptHtml", () => {
  it("prints from a hidden blob iframe once the fonts are loaded, then removes it after printing", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("about:blank");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const print = vi.fn();
    const load = vi.fn(async () => [{ status: "loaded" }]);
    const appendChild = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, "appendChild").mockImplementation(<T extends Node>(node: T) => {
      const frame = appendChild(node) as unknown as HTMLIFrameElement;
      const win = frame.contentWindow!;
      Object.defineProperty(frame.contentDocument!, "fonts", {
        configurable: true,
        value: { load, ready: Promise.resolve() },
      });
      win.print = print;
      win.focus = vi.fn();
      win.requestAnimationFrame = (callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      };
      return node;
    });

    await printReceiptHtml("<!doctype html><title>t</title>");
    const [frame] = frames();
    expect(frame.style.position).toBe("fixed");
    expect(frame.style.width).toBe("0px");
    expect(frame.getAttribute("aria-hidden")).toBe("true");
    expect(load).toHaveBeenCalledTimes(6);
    expect(load).toHaveBeenCalledWith('700 10pt "ElchiReceipt"', "қ");
    expect(load).toHaveBeenCalledWith('600 10pt "ElchiReceipt"', "қ");
    expect(print).toHaveBeenCalledTimes(1);

    frame.contentWindow!.dispatchEvent(new Event("afterprint"));
    await vi.waitFor(() => expect(frames()).toHaveLength(0));
    expect(revoke).toHaveBeenCalledWith("about:blank");
  });

  describe("keyboard focus", () => {
    /** Brauzerdagidek: `contentWindow.focus()` fokusni iframe'ga oladi. */
    const stubFrames = () => {
      vi.spyOn(URL, "createObjectURL").mockReturnValue("about:blank");
      vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
      const appendChild = document.body.appendChild.bind(document.body);
      vi.spyOn(document.body, "appendChild").mockImplementation(<T extends Node>(node: T) => {
        const frame = appendChild(node) as unknown as HTMLIFrameElement;
        const win = frame.contentWindow!;
        Object.defineProperty(frame.contentDocument!, "fonts", {
          configurable: true,
          value: { load: async () => [{ status: "loaded" }], ready: Promise.resolve() },
        });
        win.print = vi.fn();
        win.focus = () => frame.focus();
        win.requestAnimationFrame = (callback: FrameRequestCallback) => {
          callback(0);
          return 0;
        };
        return node;
      });
    };
    const button = (name: string) => {
      const element = document.createElement("button");
      element.textContent = name;
      document.body.append(element);
      return element;
    };
    const afterPrint = async () => {
      const [frame] = frames();
      expect(document.activeElement).toBe(frame);
      frame.contentWindow!.dispatchEvent(new Event("afterprint"));
      await vi.waitFor(() => expect(frames()).toHaveLength(0));
    };

    afterEach(() => document.body.replaceChildren());

    it("returns focus to the trigger once the print iframe is removed", async () => {
      stubFrames();
      const trigger = button("Chop etish");
      trigger.focus();
      await printReceiptHtml("<!doctype html><title>t</title>");
      await afterPrint();
      expect(document.activeElement).toBe(trigger);
    });

    it("does not take focus back if it moved elsewhere, or if the trigger is gone", async () => {
      stubFrames();
      const trigger = button("Chop etish");
      const other = button("Boshqa");
      trigger.focus();
      await printReceiptHtml("<!doctype html><title>t</title>");
      other.focus();
      frames()[0].contentWindow!.dispatchEvent(new Event("afterprint"));
      await vi.waitFor(() => expect(frames()).toHaveLength(0));
      expect(document.activeElement).toBe(other);

      trigger.focus();
      await printReceiptHtml("<!doctype html><title>t</title>");
      trigger.remove();
      await afterPrint();
      expect(document.activeElement).toBe(document.body);
    });
  });

  it("missing fonts → ReceiptFontError, nothing is printed and the iframe is removed", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("about:blank");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const print = vi.fn();
    const appendChild = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, "appendChild").mockImplementation(<T extends Node>(node: T) => {
      const frame = appendChild(node) as unknown as HTMLIFrameElement;
      Object.defineProperty(frame.contentDocument!, "fonts", {
        configurable: true,
        value: { load: async () => [], ready: Promise.resolve() },
      });
      frame.contentWindow!.print = print;
      return node;
    });

    await expect(printReceiptHtml("<!doctype html><title>t</title>")).rejects.toBeInstanceOf(
      ReceiptFontError,
    );
    expect(print).not.toHaveBeenCalled();
    expect(frames()).toHaveLength(0);
  });
});
