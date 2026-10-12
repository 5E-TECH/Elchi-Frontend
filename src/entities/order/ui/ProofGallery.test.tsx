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
vi.mock("../../../shared/api/api", () => ({ api: { get: apiGet }, LONG_REQUEST_TIMEOUT_MS: 120_000 }));

const IMG = "proof-1784557173685-10818f3a-6482-4bb3-b092-f85b18057d9b-Screenshot from 2025.png";
const VIDEO = "proof-1784557173686-20818f3a-6482-4bb3-b092-f85b18057d9b-yetkazish.mp4";
const BROKEN = "proof-1784557173687-30818f3a-6482-4bb3-b092-f85b18057d9b-ochirilgan.jpg";

const signed = (key: string) => `https://cdn.elchipochta.uz/files/${encodeURIComponent(key)}?X-Amz-Signature=abc`;
const blobUrl = (key: string) => `blob:http://localhost/${encodeURIComponent(key)}`;
const contentPath = (key: string) => `files/${encodeURIComponent(key)}/content`;
const httpError = (status: number) => Object.assign(new Error(String(status)), { response: { status } });

// jsdom'da `URL.createObjectURL` yo'q — blob qaysi kalitdan kelganini URL'da saqlaymiz.
const createObjectURL = vi.fn((blob: Blob & { key?: string }) => blobUrl(blob.key ?? "?"));
const revokeObjectURL = vi.fn();
Object.assign(URL, { createObjectURL, revokeObjectURL });

const keyedBlob = (key: string) => Object.assign(new Blob(["x"]), { key });

const tile = (name: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="Dalilni ochish: ${name}"]`);

describe("ProofGallery", () => {
  beforeEach(() => {
    apiGet.mockReset();
    createObjectURL.mockClear();
    // Yangi backend: `files/:key/content` — JWT + egalik tekshiruvi, baytlarni qaytaradi.
    apiGet.mockImplementation((url: string) => {
      const match = /^files\/(.+)\/content$/.exec(String(url));
      const key = decodeURIComponent(match?.[1] ?? "");
      if (key === BROKEN) return Promise.reject(httpError(403));
      if (match) return Promise.resolve({ data: keyedBlob(key) });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
  });

  it("bo'sh ro'yxat — hech narsa chizilmaydi", () => {
    const { container } = renderWithProviders(<ProofGallery keys={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("⭐ fayl baytlari JWT bilan `GET files/:key/content` dan (blob:) — MinIO ichki URL va ochiq files/view EMAS", async () => {
    renderWithProviders(<ProofGallery keys={[IMG, VIDEO]} />);

    await waitFor(() => expect(tile("Screenshot from 2025.png")?.querySelector("img")).toBeTruthy());
    expect(tile("Screenshot from 2025.png")!.querySelector("img")!.getAttribute("src")).toBe(blobUrl(IMG));

    const urls = apiGet.mock.calls.map(([url]) => String(url));
    expect(urls).toEqual([contentPath(IMG), contentPath(VIDEO)]);
    expect(urls.some((url) => url.includes("files/view"))).toBe(false);
    expect(apiGet.mock.calls[0][1]).toMatchObject({ responseType: "blob" });
  });

  it("⭐ content endpoint hali yo'q (404) — imzolangan URL `GET files/:key` ga o'tadi", async () => {
    apiGet.mockImplementation((url: string) => {
      if (String(url).endsWith("/content")) return Promise.reject(httpError(404));
      const key = decodeURIComponent(String(url).replace(/^files\//, ""));
      return Promise.resolve({ data: { statusCode: 200, data: { url: signed(key), expires_in: 3600 } } });
    });
    renderWithProviders(<ProofGallery keys={[IMG]} />);

    await waitFor(() => expect(tile("Screenshot from 2025.png")?.querySelector("img")).toBeTruthy());
    expect(tile("Screenshot from 2025.png")!.querySelector("img")!.getAttribute("src")).toBe(signed(IMG));
    expect(apiGet.mock.calls.map(([url]) => String(url))).toEqual([contentPath(IMG), `files/${encodeURIComponent(IMG)}`]);
    expect(apiGet.mock.calls[1][1]).toEqual({ params: { expires_in: 3600 } });
  });

  it("⭐ URL olindi, lekin brauzer ocha olmadi (prod: minio:9000) — buzilgan rasm emas, \"ochib bo'lmadi\"", async () => {
    renderWithProviders(<ProofGallery keys={[IMG]} />);
    await waitFor(() => expect(tile("Screenshot from 2025.png")?.querySelector("img")).toBeTruthy());

    fireEvent.error(tile("Screenshot from 2025.png")!.querySelector("img")!);
    expect(tile("Screenshot from 2025.png")!.querySelector("img")).toBeNull();
    expect(within(tile("Screenshot from 2025.png")!).getByText("Faylni ochib bo'lmadi")).toBeInTheDocument();
  });

  it("rasm — <img>, video — <video> + play belgisi (kengaytma bo'yicha)", async () => {
    renderWithProviders(<ProofGallery keys={[IMG, VIDEO]} />);
    await waitFor(() => expect(tile("yetkazish.mp4")?.querySelector("video")).toBeTruthy());

    expect(tile("Screenshot from 2025.png")!.dataset.proofKind).toBe("image");
    const video = tile("yetkazish.mp4")!;
    expect(video.dataset.proofKind).toBe("video");
    expect(video.querySelector("video")!.getAttribute("src")).toBe(blobUrl(VIDEO));
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
    expect(lightbox.querySelector("img")!.getAttribute("src")).toBe(blobUrl(IMG));
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    // Asl faylni yangi oynada ochish havolasi — imzolangan URL, xavfsiz `rel`.
    const original = within(lightbox).getByText("Yangi oynada ochish").closest("a")!;
    expect(original.getAttribute("href")).toBe(blobUrl(IMG));
    expect(original.getAttribute("rel")).toBe("noopener noreferrer");

    fireEvent.click(lightbox.querySelector('button[aria-label="Keyingi"]')!);
    await waitFor(() => expect(screen.getByTestId("proof-lightbox").querySelector("video")).toBeTruthy());
    const playing = screen.getByTestId("proof-lightbox").querySelector("video")!;
    expect(screen.getByTestId("proof-lightbox").querySelector("img")).toBeNull();
    expect(playing.getAttribute("src")).toBe(blobUrl(VIDEO));
    expect(playing.hasAttribute("controls")).toBe(true);
    expect(screen.getByText("2 / 2")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByText("1 / 2")).toBeInTheDocument());
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    await waitFor(() => expect(screen.getByText("2 / 2")).toBeInTheDocument());
  });
});
