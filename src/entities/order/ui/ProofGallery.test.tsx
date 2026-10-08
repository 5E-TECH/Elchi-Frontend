import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils";
import ProofGallery from "./ProofGallery";

/**
 * DALILLAR GALEREYASI.
 *
 * ⚠️ `getByRole` ISHLATILMAYDI: antd v6 CSS-in-JS jsdom'da yaroqsiz selektor
 * chiqaradi va a11y hisoblash `SyntaxError` beradi. Elementlar `aria-label`
 * va `data-testid` bo'yicha topiladi.
 */

const apiGet = vi.hoisted(() => vi.fn());
vi.mock("../../../shared/api/api", () => ({ api: { get: apiGet } }));

const IMG = "proof-1784557173685-10818f3a-6482-4bb3-b092-f85b18057d9b-Screenshot from 2025.png";
const VIDEO = "proof-1784557173686-20818f3a-6482-4bb3-b092-f85b18057d9b-yetkazish.mp4";
const BROKEN = "proof-1784557173687-30818f3a-6482-4bb3-b092-f85b18057d9b-ochirilgan.jpg";

const signed = (key: string) => `https://cdn.elchipochta.uz/files/${encodeURIComponent(key)}?X-Amz-Signature=abc`;

const tile = (name: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="Dalilni ochish: ${name}"]`);

describe("ProofGallery", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation((url: string) => {
      const key = decodeURIComponent(String(url).replace(/^files\//, ""));
      if (key === BROKEN) return Promise.reject(Object.assign(new Error("Forbidden"), { response: { status: 403 } }));
      return Promise.resolve({ data: { statusCode: 200, data: { url: signed(key), expires_in: 3600 } } });
    });
  });

  it("bo'sh ro'yxat — hech narsa chizilmaydi", () => {
    const { container } = renderWithProviders(<ProofGallery keys={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("⭐ har kalit uchun IMZOLANGAN URL `GET files/:key` dan olinadi — ochiq files/view EMAS", async () => {
    renderWithProviders(<ProofGallery keys={[IMG, VIDEO]} />);

    await waitFor(() => expect(tile("Screenshot from 2025.png")?.querySelector("img")).toBeTruthy());
    expect(tile("Screenshot from 2025.png")!.querySelector("img")!.getAttribute("src")).toBe(signed(IMG));

    const urls = apiGet.mock.calls.map(([url]) => String(url));
    expect(urls).toEqual([`files/${encodeURIComponent(IMG)}`, `files/${encodeURIComponent(VIDEO)}`]);
    expect(urls.some((url) => url.includes("files/view"))).toBe(false);
    expect(apiGet.mock.calls[0][1]).toEqual({ params: { expires_in: 3600 } });
  });

  it("rasm — <img>, video — <video> + play belgisi (kengaytma bo'yicha)", async () => {
    renderWithProviders(<ProofGallery keys={[IMG, VIDEO]} />);
    await waitFor(() => expect(tile("yetkazish.mp4")?.querySelector("video")).toBeTruthy());

    expect(tile("Screenshot from 2025.png")!.dataset.proofKind).toBe("image");
    const video = tile("yetkazish.mp4")!;
    expect(video.dataset.proofKind).toBe("video");
    expect(video.querySelector("video")!.getAttribute("src")).toBe(signed(VIDEO));
    expect(video.querySelector("video")!.hasAttribute("controls")).toBe(false);
    // .mp4 uchun <img> UMUMAN yo'q — faqat <video>.
    expect(video.querySelector("img")).toBeNull();
  });

  it("⭐ bitta faylning xatosi (403 / o'chirilgan) qolganlarini to'smaydi", async () => {
    renderWithProviders(<ProofGallery keys={[IMG, BROKEN]} />);

    // `retry: 1` — bitta qayta urinishdan keyin xato ko'rsatiladi.
    await waitFor(
      () => expect(within(tile("ochirilgan.jpg")!).getByText("Faylni ochib bo'lmadi")).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(tile("Screenshot from 2025.png")!.querySelector("img")).toBeTruthy();
  });

  it("plitka bosilsa lightbox ochiladi; oldingi / keyingi va strelkalar bilan almashadi", async () => {
    renderWithProviders(<ProofGallery keys={[IMG, VIDEO]} />);
    await waitFor(() => expect(tile("Screenshot from 2025.png")?.querySelector("img")).toBeTruthy());

    fireEvent.click(tile("Screenshot from 2025.png")!);
    const lightbox = await screen.findByTestId("proof-lightbox");
    expect(lightbox.querySelector("img")!.getAttribute("src")).toBe(signed(IMG));
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    // Asl faylni yangi oynada ochish havolasi — imzolangan URL, xavfsiz `rel`.
    const original = within(lightbox).getByText("Yangi oynada ochish").closest("a")!;
    expect(original.getAttribute("href")).toBe(signed(IMG));
    expect(original.getAttribute("rel")).toBe("noopener noreferrer");

    fireEvent.click(lightbox.querySelector('button[aria-label="Keyingi"]')!);
    await waitFor(() => expect(screen.getByTestId("proof-lightbox").querySelector("video")).toBeTruthy());
    const playing = screen.getByTestId("proof-lightbox").querySelector("video")!;
    expect(screen.getByTestId("proof-lightbox").querySelector("img")).toBeNull();
    expect(playing.getAttribute("src")).toBe(signed(VIDEO));
    expect(playing.hasAttribute("controls")).toBe(true);
    expect(screen.getByText("2 / 2")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByText("1 / 2")).toBeInTheDocument());
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    await waitFor(() => expect(screen.getByText("2 / 2")).toBeInTheDocument());
  });
});
