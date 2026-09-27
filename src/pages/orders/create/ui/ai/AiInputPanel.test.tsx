import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { AxiosError, CanceledError, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../../test/test-utils";
import { aiApiGet, aiPreview } from "../../../../../test/aiOrderFixtures";

const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn(), prepareImage: vi.fn() }));

vi.mock("../../../../../shared/api/api", () => ({ api: { post: mocks.post, get: mocks.get } }));
vi.mock("../../../../../shared/lib/downscaleImage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../../shared/lib/downscaleImage")>()),
  prepareImage: mocks.prepareImage,
}));

import { PrepareImageError } from "../../../../../shared/lib/downscaleImage";
import AiInputPanel from "./AiInputPanel";

/**
 * AI KIRISH PANELI (9sWDqibg).
 */

const prepared = (name: string, kb = 412) => ({
  media_type: "image/jpeg",
  data_base64: btoa("JPEG"),
  preview: "data:image/jpeg;base64,SlBFRw==",
  name: name.replace(/\.\w+$/, ".jpg"),
  bytes: kb * 1024,
});

const file = (name: string, type = "image/jpeg") => new File(["x"], name, { type });

const selectFiles = (files: File[]) => {
  const input = screen.getByTestId("ai-image-input") as HTMLInputElement;
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);
};

const textarea = () => screen.getByLabelText("Buyurtma matni") as HTMLTextAreaElement;
const parseButton = () => screen.getByRole("button", { name: /Tahlil qilish|Qayta tahlil qil|soniyadan keyin/ });

const renderPanel = () => {
  const onParsed = vi.fn();
  const onSwitchToManual = vi.fn();
  renderWithProviders(<AiInputPanel marketId="7" onParsed={onParsed} onSwitchToManual={onSwitchToManual} />);
  return { onParsed, onSwitchToManual };
};

beforeEach(() => {
  mocks.post.mockReset();
  mocks.get.mockReset();
  mocks.get.mockImplementation(aiApiGet);
  mocks.prepareImage.mockReset();
  mocks.prepareImage.mockImplementation((f: File) => Promise.resolve(prepared(f.name)));
});

describe("AiInputPanel", () => {
  it("matn ham, rasm ham bo'sh bo'lsa \"Tahlil qilish\" disabled", () => {
    renderPanel();
    expect(parseButton()).toBeDisabled();

    fireEvent.change(textarea(), { target: { value: "  " } });
    expect(parseButton()).toBeDisabled();

    fireEvent.change(textarea(), { target: { value: "Vali 90 123 45 67" } });
    expect(parseButton()).toBeEnabled();
  });

  it("4000 belgidan oshirib yozib bo'lmaydi (kesilmaydi) va hisoblagich qizaradi", () => {
    renderPanel();
    const full = "a".repeat(4000);

    fireEvent.change(textarea(), { target: { value: full } });
    expect(screen.getByTestId("ai-text-counter")).toHaveTextContent("4000 / 4000");
    expect(screen.getByTestId("ai-text-counter").className).toContain("text-error");

    fireEvent.change(textarea(), { target: { value: `${full}b` } });
    expect(textarea().value).toHaveLength(4000);
    expect(screen.getByText(/4000 belgidan oshmasligi kerak/)).toBeInTheDocument();
  });

  it("3 tadan ortiq rasm tanlansa xabar chiqadi va birinchi 3 tasi QABUL qilinadi", async () => {
    renderPanel();

    selectFiles([file("1.jpg"), file("2.jpg"), file("3.jpg"), file("4.jpg")]);

    expect(await screen.findByText(/Ko'pi bilan 3 ta rasm/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("ai-image-grid").children).toHaveLength(3));
    expect(mocks.prepareImage).toHaveBeenCalledTimes(3);
    expect(mocks.prepareImage.mock.calls.map(([f]) => (f as File).name)).toEqual(["1.jpg", "2.jpg", "3.jpg"]);
  });

  it("bo'sh slotlar hisoblanadi: 2 ta rasm bor bo'lsa yangi tanlovdan faqat 1 tasi olinadi", async () => {
    renderPanel();
    selectFiles([file("1.jpg"), file("2.jpg")]);
    await waitFor(() => expect(screen.getByTestId("ai-image-grid").children).toHaveLength(2));

    selectFiles([file("3.jpg"), file("4.jpg")]);

    await waitFor(() => expect(screen.getByTestId("ai-image-grid").children).toHaveLength(3));
    expect(screen.getByText(/Ko'pi bilan 3 ta rasm/)).toBeInTheDocument();
  });

  it("PDF → \"faqat surat\", HEIC → alohida tushuntirish", async () => {
    mocks.prepareImage.mockImplementation((f: File) =>
      Promise.reject(new PrepareImageError(f.name.endsWith(".pdf") ? "unsupported" : "heic_unsupported")),
    );
    renderPanel();

    selectFiles([file("hujjat.pdf", "application/pdf"), file("IMG_1.HEIC", "image/heic")]);

    expect(await screen.findByText(/hujjat\.pdf: faqat surat yuklash mumkin/)).toBeInTheDocument();
    expect(screen.getByText(/IMG_1\.HEIC: HEIC surat — telefonda JPEG qilib saqlang/)).toBeInTheDocument();
  });

  it("tayyorlash davomida progress ko'rinadi, eskizda hajm (KB) chiqadi", async () => {
    let finish!: () => void;
    mocks.prepareImage.mockImplementationOnce(
      (f: File) => new Promise((resolve) => (finish = () => resolve(prepared(f.name, 487)))),
    );
    renderPanel();

    selectFiles([file("IMG_12MB.jpg")]);

    expect(await screen.findByText("1/1 tayyorlanmoqda...")).toBeInTheDocument();
    await act(async () => finish());
    expect(await screen.findByText("487 KB")).toBeInTheDocument();
    expect(screen.queryByText("1/1 tayyorlanmoqda...")).not.toBeInTheDocument();
  });

  it("eskizdagi × bosilganda faqat o'sha rasm chiqadi", async () => {
    renderPanel();
    selectFiles([file("a.jpg"), file("b.jpg")]);
    await waitFor(() => expect(screen.getByTestId("ai-image-grid").children).toHaveLength(2));

    fireEvent.click(screen.getAllByRole("button", { name: "Suratni olib tashlash" })[0]);

    expect(screen.getByTestId("ai-image-grid").children).toHaveLength(1);
    expect(screen.getByAltText("b.jpg")).toBeInTheDocument();
  });

  it("so'rov: orders/ai-parse, timeout 90000, signal, market_id va tayyorlangan rasm", async () => {
    mocks.post.mockResolvedValue({ data: { statusCode: 200, data: { ok: true, orders: [] } } });
    renderPanel();
    selectFiles([file("a.jpg")]);
    await waitFor(() => expect(screen.getByTestId("ai-image-grid").children).toHaveLength(1));
    fireEvent.change(textarea(), { target: { value: "Vali 90 123 45 67" } });

    fireEvent.click(parseButton());

    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    const [url, body, config] = mocks.post.mock.calls[0];
    expect(url).toBe("orders/ai-parse");
    expect(config.timeout).toBe(90_000);
    expect(config.signal).toBeInstanceOf(AbortSignal);
    expect((body as FormData).get("market_id")).toBe("7");
    expect((body as FormData).get("text")).toBe("Vali 90 123 45 67");
    expect(((body as FormData).get("images") as File).name).toBe("a.jpg");
  });

  it("tahlil davomida spinner + \"Bekor qilish\", textarea tahrirlanmaydi; bekor qilinsa xato chiqmaydi, tugma yana faol", async () => {
    mocks.post.mockImplementation(
      (_url: string, _body: unknown, config: { signal: AbortSignal }) =>
        new Promise((_, reject) =>
          config.signal.addEventListener("abort", () =>
            reject(new CanceledError(undefined, undefined, config as unknown as InternalAxiosRequestConfig)),
          ),
        ),
    );
    const networkToast = vi.fn();
    window.addEventListener("elchi:network-error", networkToast);
    renderPanel();
    fireEvent.change(textarea(), { target: { value: "matn" } });

    fireEvent.click(parseButton());

    expect(await screen.findByText("AI o'qiyapti... (odatda 5-20 soniya)")).toBeInTheDocument();
    expect(textarea()).toHaveAttribute("readonly");

    fireEvent.click(screen.getByRole("button", { name: "Bekor qilish" }));

    await waitFor(() => expect(parseButton()).toBeEnabled());
    expect(parseButton()).toHaveTextContent("Tahlil qilish");
    expect(screen.queryByText("AI o'qiyapti... (odatda 5-20 soniya)")).not.toBeInTheDocument();
    expect(textarea()).not.toHaveAttribute("readonly");
    expect(networkToast).not.toHaveBeenCalled();
    window.removeEventListener("elchi:network-error", networkToast);
  });

  it("xato bo'lsa AVTOMATIK qayta so'rov yo'q — bitta POST va \"Qayta tahlil qil\" tugmasi", async () => {
    mocks.post.mockRejectedValue(
      new AxiosError("fail", "ERR_BAD_RESPONSE", undefined, null, {
        status: 500,
        statusText: "",
        headers: {},
        config: {} as InternalAxiosRequestConfig,
        data: { message: "AI xizmati javob bermadi" },
      }),
    );
    renderPanel();
    fireEvent.change(textarea(), { target: { value: "matn" } });

    fireEvent.click(parseButton());

    expect(await screen.findByText("AI xizmati javob bermadi")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(parseButton()).toHaveTextContent("Qayta tahlil qil");
  });

  it("429 kelsa aniq matn chiqadi va tugma 60 soniyaga bloklanadi (sanoq bilan)", async () => {
    mocks.post.mockRejectedValue(
      new AxiosError("throttled", "ERR_BAD_REQUEST", undefined, null, {
        status: 429,
        statusText: "",
        headers: {},
        config: {} as InternalAxiosRequestConfig,
        data: {},
      }),
    );
    renderPanel();
    fireEvent.change(textarea(), { target: { value: "matn" } });

    fireEvent.click(parseButton());

    expect(await screen.findByText("Juda tez-tez so'rov. Bir daqiqa kuting.")).toBeInTheDocument();
    expect(parseButton()).toBeDisabled();
    expect(parseButton()).toHaveTextContent(/^(60|59) soniyadan keyin$/);
  });

  it("muvaffaqiyatli tahlildan keyin panel yig'iladi, matn saqlanadi va qayta ochiladi", async () => {
    const order = aiPreview();
    mocks.post.mockResolvedValue({ data: { statusCode: 200, data: { ok: true, orders: [order] } } });
    const { onParsed } = renderPanel();
    fireEvent.change(textarea(), { target: { value: "Aliyev Vali 90 123 45 67 Chilonzor" } });

    fireEvent.click(parseButton());

    expect(await screen.findByTestId("ai-input-collapsed")).toHaveTextContent("Aliyev Vali 90 123 45 67 Chilonzor");
    expect(onParsed).toHaveBeenCalledWith([order]);

    fireEvent.click(screen.getByRole("button", { name: "Matnni tahrirlash" }));
    expect(textarea().value).toBe("Aliyev Vali 90 123 45 67 Chilonzor");
  });

  it("AI o'chiq (`disabled`/`ai_off`) bo'lsa tushuntirish va \"Qo'lda yaratish\" tugmasi chiqadi", async () => {
    mocks.post.mockResolvedValue({ data: { statusCode: 200, data: { ok: false, reason: "ai_off" } } });
    const { onSwitchToManual, onParsed } = renderPanel();
    fireEvent.change(textarea(), { target: { value: "matn" } });

    fireEvent.click(parseButton());

    expect(await screen.findByText("AI hozir o'chiq")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Qo'lda yaratish" }));
    expect(onSwitchToManual).toHaveBeenCalledTimes(1);
    expect(onParsed).not.toHaveBeenCalled();
  });
});
