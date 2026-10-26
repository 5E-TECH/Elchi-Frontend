import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
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

/** Matn maydoni — karta sarlavhasidagi `<label>` bilan nomlangan (karta ham shu sarlavha bilan nomlangan). */
const textarea = () => screen.getByRole("textbox", { name: "Buyurtma matni" }) as HTMLTextAreaElement;
const parseButton = () =>
  screen.getByRole("button", { name: /Tahlil qilish|Qayta urinib ko'ring|soniyadan keyin/ });

const renderPanel = ({ onSelectMarket }: { onSelectMarket?: () => void } = {}) => {
  const onParsed = vi.fn();
  const onSwitchToManual = vi.fn();
  renderWithProviders(
    <AiInputPanel
      marketId="7"
      onParsed={onParsed}
      onSwitchToManual={onSwitchToManual}
      onSelectMarket={onSelectMarket}
    />,
  );
  return { onParsed, onSwitchToManual };
};

const httpError = (status: number, data: unknown = {}) =>
  new AxiosError("fail", "ERR_BAD_RESPONSE", undefined, null, {
    status,
    statusText: "",
    headers: {},
    config: {} as InternalAxiosRequestConfig,
    data,
  });

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
    expect(screen.getByTestId("ai-text-counter")).toHaveTextContent("4 000 / 4 000");
    expect(screen.getByTestId("ai-text-counter").className).toContain("text-danger-fg");
    // Hisoblagich maydonga bog'langan (ekran o'quvchi ham eshitadi).
    expect(textarea()).toHaveAttribute("aria-describedby", expect.stringContaining(screen.getByTestId("ai-text-counter").id));

    fireEvent.change(textarea(), { target: { value: `${full}b` } });
    expect(textarea().value).toHaveLength(4000);
    expect(screen.getByText(/4000 belgidan oshmasligi kerak/)).toBeInTheDocument();
    expect(textarea()).toHaveAttribute("aria-invalid", "true");
  });

  const files = (count: number, from = 1) => Array.from({ length: count }, (_, i) => file(`${from + i}.jpg`));

  it("20 tadan ortiq rasm tanlansa backend matni chiqadi va birinchi 20 tasi QABUL qilinadi (WHMAIqyo)", async () => {
    renderPanel();

    selectFiles(files(21));

    expect(await screen.findByText("Ko'pi bilan 20 ta rasm yuborish mumkin. Birinchilari qabul qilindi.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("ai-image-grid").children).toHaveLength(20));
    expect(mocks.prepareImage).toHaveBeenCalledTimes(20);
    expect(mocks.prepareImage.mock.calls.map(([f]) => (f as File).name)).toEqual(files(20).map((f) => f.name));
    // Har rasm 1,5 MB chegarasi bilan tayyorlanadi (kerak bo'lsa sifat tushiriladi).
    expect(mocks.prepareImage).toHaveBeenCalledWith(expect.any(File), { maxBytes: 1.5 * 1024 * 1024 });
    expect(screen.getByRole("button", { name: "Surat qo'shish (20/20)" })).toBeDisabled();
  });

  it("bo'sh slotlar hisoblanadi: 18 ta rasm bor bo'lsa yangi tanlovdan faqat 2 tasi olinadi", async () => {
    renderPanel();
    selectFiles(files(18));
    await waitFor(() => expect(screen.getByTestId("ai-image-grid").children).toHaveLength(18));

    selectFiles(files(3, 19));

    await waitFor(() => expect(screen.getByTestId("ai-image-grid").children).toHaveLength(20));
    expect(screen.getByText(/Ko'pi bilan 20 ta rasm yuborish mumkin/)).toBeInTheDocument();
  });

  it("kichraytirilgan rasm 1,5 MB dan katta (`over_limit`) → fayl nomi bilan xabar, eskiz qo'shilmaydi", async () => {
    mocks.prepareImage.mockImplementation((f: File) =>
      f.name === "katta.jpg" ? Promise.reject(new PrepareImageError("over_limit")) : Promise.resolve(prepared(f.name)),
    );
    renderPanel();

    selectFiles([file("katta.jpg"), file("oddiy.jpg")]);

    expect(await screen.findByText("katta.jpg: rasm 1,5 MB dan katta — kichikroq surat tanlang")).toBeInTheDocument();
    expect(screen.getByTestId("ai-image-grid").children).toHaveLength(1);
  });

  it("jami 20 MB dan oshadigan rasm qo'shilmaydi, kichigi hali sig'adi; × bosilsa xabar yo'qoladi", async () => {
    // 14 × 1,4 MB = 19,6 MB; keyingi 1,4 MB sig'maydi, 300 KB sig'adi.
    mocks.prepareImage.mockImplementation((f: File) =>
      Promise.resolve(prepared(f.name, f.name === "kichik.jpg" ? 300 : 1.4 * 1024)),
    );
    renderPanel();

    selectFiles([...files(15), file("kichik.jpg")]);

    expect(
      await screen.findByText("Rasmlar jami 20 MB dan oshmasligi kerak — sig'maganlari qo'shilmadi."),
    ).toBeInTheDocument();
    const grid = screen.getByTestId("ai-image-grid");
    expect(grid.children).toHaveLength(15);
    expect(within(grid).queryByAltText("15.jpg")).not.toBeInTheDocument();
    expect(within(grid).getByAltText("kichik.jpg")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Suratni olib tashlash: 1.jpg" }));
    expect(screen.queryByText(/Rasmlar jami 20 MB/)).not.toBeInTheDocument();
  });

  it("WebP surat qabul qilinadi (gateway endi JPEG, PNG, WebP oladi)", async () => {
    renderPanel();
    selectFiles([file("rasm.webp", "image/webp")]);
    expect(await screen.findByAltText("rasm.jpg")).toBeInTheDocument();
    expect(screen.queryByText(/faqat JPEG, PNG yoki WebP/)).not.toBeInTheDocument();
  });

  it("PDF → \"faqat JPEG, PNG yoki WebP\", HEIC → alohida tushuntirish", async () => {
    mocks.prepareImage.mockImplementation((f: File) =>
      Promise.reject(new PrepareImageError(f.name.endsWith(".pdf") ? "unsupported" : "heic_unsupported")),
    );
    renderPanel();

    selectFiles([file("hujjat.pdf", "application/pdf"), file("IMG_1.HEIC", "image/heic")]);

    expect(await screen.findByText("hujjat.pdf: faqat JPEG, PNG yoki WebP rasm")).toBeInTheDocument();
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

    // Har tugma nomida fayl nomi bor — qaysi surat olib tashlanishi aniq.
    fireEvent.click(screen.getByRole("button", { name: "Suratni olib tashlash: a.jpg" }));

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

  it("5xx bo'lsa \"Server javob bermadi\", AVTOMATIK qayta so'rov yo'q — bitta POST va qo'lda \"Qayta urinib ko'ring\"", async () => {
    mocks.post.mockRejectedValue(httpError(504, { message: "Gateway Timeout" }));
    renderPanel();
    fireEvent.change(textarea(), { target: { value: "matn" } });

    fireEvent.click(parseButton());

    expect(await screen.findByText("Server javob bermadi")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(parseButton()).toHaveTextContent("Qayta urinib ko'ring");

    fireEvent.click(parseButton());
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
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
    expect(onParsed).toHaveBeenCalledWith([order], undefined);

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

  it("tahlil javobidagi `draft_id` onParsed ga uzatiladi (xarajatni buyurtmaga bog'lash)", async () => {
    const order = aiPreview();
    mocks.post.mockResolvedValue({
      data: { statusCode: 200, data: { ok: true, orders: [order], draft_id: "3f0c2a52-8a5b-4c6e-9d0e-1b2c3d4e5f60" } },
    });
    const { onParsed } = renderPanel();
    fireEvent.change(textarea(), { target: { value: "matn" } });

    fireEvent.click(parseButton());

    await waitFor(() => expect(onParsed).toHaveBeenCalledWith([order], "3f0c2a52-8a5b-4c6e-9d0e-1b2c3d4e5f60"));
  });

  describe("har sabab o'z matni va harakati bilan (bVeyEuIR #5/#7/#9, NsxoDSmm #11)", () => {
    const failWith = async (reason: string) => {
      mocks.post.mockResolvedValue({ data: { statusCode: 200, data: { ok: false, reason } } });
      const handlers = renderPanel();
      fireEvent.change(textarea(), { target: { value: "matn" } });
      fireEvent.click(parseButton());
      return handlers;
    };

    it("network → \"AI javob bermadi\" va \"Qayta urinib ko'ring\" tugmasi", async () => {
      await failWith("network");
      expect(await screen.findByText("AI javob bermadi. Birozdan keyin qayta urinib ko'ring.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Qayta urinib ko'ring" })).toBeEnabled();
    });

    it("refused → alohida matn va \"Qo'lda kiritish\" qo'lda rejimga o'tkazadi", async () => {
      const { onSwitchToManual } = await failWith("refused");
      expect(await screen.findByText("AI bu matnni qayta ishlamadi")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Qo'lda kiritish" }));
      expect(onSwitchToManual).toHaveBeenCalledTimes(1);
    });

    it("cap_exceeded → \"AI limiti\" matni, \"o'chiq\" deb EMAS", async () => {
      await failWith("cap_exceeded");
      const block = await screen.findByTestId("ai-block");
      expect(block).toHaveTextContent("AI kunlik limiti tugadi");
      expect(block).not.toHaveTextContent(/o'chiq|o'chirilgan/);
      expect(screen.getByRole("button", { name: "Qo'lda kiritish" })).toBeInTheDocument();
    });

    it("truncated, network, disabled — uchalasi TURLI xabar (hammasi \"AI o'qiy olmadi\" emas)", async () => {
      const texts: string[] = [];
      for (const reason of ["truncated", "network", "disabled"]) {
        const view = await failWith(reason);
        await waitFor(() => expect(screen.queryByText("AI o'qiyapti... (odatda 5-20 soniya)")).not.toBeInTheDocument());
        const shown = await screen.findByText(/qismlarga|javob bermadi|AI hozir o'chiq/);
        texts.push(shown.textContent ?? "");
        view.onParsed.mockReset();
        cleanup();
      }
      expect(new Set(texts).size).toBe(3);
      expect(texts.some((t) => t.includes("AI matndan buyurtma o'qiy olmadi"))).toBe(false);
    });

    it("no_market → operator marketga biriktirilmagan", async () => {
      await failWith("no_market");
      expect(await screen.findByText(/Operator marketga biriktirilmagan/)).toBeInTheDocument();
    });

    it("no_market (admin) → \"Marketni tanlash\" market tanlashga qaytaradi", async () => {
      const onSelectMarket = vi.fn();
      mocks.post.mockResolvedValue({ data: { statusCode: 200, data: { ok: false, reason: "no_market" } } });
      renderPanel({ onSelectMarket });
      fireEvent.change(textarea(), { target: { value: "matn" } });
      fireEvent.click(parseButton());

      expect(await screen.findByText("Market aniqlanmadi")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Marketni tanlash" }));
      expect(onSelectMarket).toHaveBeenCalledTimes(1);
    });

    it("ai_error → yozish bo'yicha maslahat + \"Matnni tahrirlash\"; qayta urinish TAKLIF QILINMAYDI", async () => {
      await failWith("ai_error");
      expect(await screen.findByText("AI matndan buyurtma topa olmadi")).toBeInTheDocument();
      expect(within(screen.getByTestId("ai-error")).getByText("Har buyurtmani yangi qatordan, telefon raqami bilan yozing.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Qayta urinib ko'ring" })).not.toBeInTheDocument();
      expect(parseButton()).toHaveTextContent("Tahlil qilish");

      fireEvent.click(screen.getByRole("button", { name: "Matnni tahrirlash" }));
      expect(textarea()).toHaveFocus();
    });

    it("truncated → \"Matn juda uzun\" + \"Matnni tahrirlash\"", async () => {
      await failWith("truncated");
      expect(await screen.findByText("Matn juda uzun")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Matnni tahrirlash" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Qayta urinib ko'ring" })).not.toBeInTheDocument();
    });

    it("insufficient → \"AI limiti tugadi\" + \"Qo'lda yaratish\"", async () => {
      const { onSwitchToManual } = await failWith("insufficient");
      expect(await screen.findByText("AI limiti tugadi")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Qo'lda yaratish" }));
      expect(onSwitchToManual).toHaveBeenCalledTimes(1);
    });
  });

  describe("HTTP xatolari (6LSlbHoi #5)", () => {
    const failWithHttp = async (error: unknown) => {
      mocks.post.mockRejectedValue(error);
      renderPanel();
      fireEvent.change(textarea(), { target: { value: "matn" } });
      fireEvent.click(parseButton());
    };

    it("400 → \"Ma'lumot noto'g'ri\" + server izohi (massiv bo'lsa ham)", async () => {
      await failWithHttp(httpError(400, { message: ["text must be shorter", "images too many"] }));
      expect(await screen.findByText("Ma'lumot noto'g'ri")).toBeInTheDocument();
      expect(screen.getByText("text must be shorter, images too many")).toBeInTheDocument();
      expect(screen.queryByText(/Request failed/)).not.toBeInTheDocument();
    });

    it.each([
      ["Ko'pi bilan 20 ta rasm yuborish mumkin", "Ko'pi bilan 20 ta rasm yuborish mumkin. Ortiqchasini olib tashlang."],
      ["Too many files", "Ko'pi bilan 20 ta rasm yuborish mumkin. Ortiqchasini olib tashlang."],
      ["Rasm 1,5 MB dan katta", "Rasm 1,5 MB dan katta — kichikroq surat tanlang."],
      ["Rasmlar jami 20 MB dan oshmasligi kerak", "Rasmlar jami 20 MB dan oshmasligi kerak — bir qismini olib tashlang."],
      ["Faqat JPEG, PNG yoki WebP rasm", "Faqat JPEG, PNG yoki WebP rasm yuborish mumkin."],
      ["Rasm fayli buzilgan yoki o'qib bo'lmadi", "Rasm fayli buzilgan yoki o'qib bo'lmadi — boshqa surat tanlang."],
      ["Rasm fayli buzilgan yoki turi mos emas", "Rasm fayli buzilgan yoki o'qib bo'lmadi — boshqa surat tanlang."],
    ])("400 «%s» → «Rasm qabul qilinmadi» + o'z matni (server matni xom emas)", async (serverText, shown) => {
      await failWithHttp(httpError(400, { message: serverText }));
      expect(await screen.findByText("Rasm qabul qilinmadi")).toBeInTheDocument();
      expect(screen.getByText(shown)).toBeInTheDocument();
      expect(screen.queryByText("Ma'lumot noto'g'ri")).not.toBeInTheDocument();
      if (serverText !== shown) expect(screen.queryByText(serverText)).not.toBeInTheDocument();
    });

    it("413 → \"Rasm juda katta\"", async () => {
      await failWithHttp(httpError(413));
      expect(await screen.findByText("Rasm juda katta")).toBeInTheDocument();
      expect(screen.getByText("Rasmlar sonini kamaytiring yoki boshqa surat tanlang.")).toBeInTheDocument();
    });

    it("javob umuman kelmasa → \"Aloqa uzildi\" va qo'lda qayta urinish", async () => {
      await failWithHttp(new AxiosError("Network Error", "ERR_NETWORK"));
      expect(await screen.findByText("Aloqa uzildi")).toBeInTheDocument();
      expect(parseButton()).toHaveTextContent("Qayta urinib ko'ring");
    });
  });
  describe("telefon 390px (JzQIec06)", () => {
    it("\"Surat olish\" — orqa kamera (capture), \"Galereyadan\" — bir nechta surat (capture yo'q)", () => {
      renderPanel();
      const camera = screen.getByTestId("ai-camera-input") as HTMLInputElement;
      const gallery = screen.getByTestId("ai-image-input") as HTMLInputElement;
      expect(camera).toHaveAttribute("capture", "environment");
      expect(gallery).not.toHaveAttribute("capture");
      expect(gallery.multiple).toBe(true);

      const cameraClick = vi.spyOn(camera, "click");
      const galleryClick = vi.spyOn(gallery, "click");
      fireEvent.click(screen.getByRole("button", { name: "Surat olish" }));
      fireEvent.click(screen.getByRole("button", { name: "Galereyadan" }));
      expect(cameraClick).toHaveBeenCalledTimes(1);
      expect(galleryClick).toHaveBeenCalledTimes(1);
    });

    it("kameradan olingan surat ham tayyorlanadi va eskizda chiqadi", async () => {
      renderPanel();
      const camera = screen.getByTestId("ai-camera-input") as HTMLInputElement;
      Object.defineProperty(camera, "files", { value: [file("kamera.jpg")], configurable: true });
      fireEvent.change(camera);

      expect(await screen.findByAltText("kamera.jpg")).toBeInTheDocument();
      expect(screen.getByText("1/20 surat")).toBeInTheDocument();
    });

    it("20 ta surat bo'lsa ikkala telefon tugmasi ham o'chadi", async () => {
      renderPanel();
      selectFiles(Array.from({ length: 20 }, (_, i) => file(`p${i}.jpg`)));
      await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(20));
      expect(screen.getByRole("button", { name: "Surat olish" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Galereyadan" })).toBeDisabled();
    });
  });
});
