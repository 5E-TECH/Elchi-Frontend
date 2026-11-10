/**
 * SSE (`text/event-stream`) bo'laklab o'quvchi — `fetch` + `ReadableStream` uchun (WHATWG HTML «Server-sent events»
 * qoidalari, `EventSource` siz). Toza: tarmoq yo'q, faqat baytlar → hodisalar.
 *
 *   - UTF-8 `TextDecoder({ stream: true })` — ko'p baytli harf ikki bo'lakka bo'linsa ham buzilmaydi;
 *   - qator oxiri `\n`, `\r\n` yoki `\r` (bo'lak oxiridagi `\r` keyingi `\n` ni kutadi);
 *   - `:` bilan boshlanadigan qator — izoh (`: ping`), e'tiborsiz;
 *   - `data:` qatorlari `\n` bilan qo'shiladi; bo'sh qator — hodisa tugadi (`data` bo'sh bo'lsa — chiqmaydi);
 *   - maydon qiymatidagi bitta boshlang'ich bo'shliq olinadi; noma'lum maydon (`id`, `retry` …) e'tiborsiz;
 *   - `flush()` — oqim yopilganda yarim qolgan (bo'sh qatorsiz) hodisa ham chiqariladi.
 */

export interface SseMessage {
  /** `event:` maydoni; yo'q bo'lsa — `"message"`. */
  event: string;
  data: string;
}

export interface SseParser {
  push: (chunk: Uint8Array | string) => SseMessage[];
  flush: () => SseMessage[];
}

export const createSseParser = (): SseParser => {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let eventName = "";
  let dataLines: string[] = [];
  let hasData = false;

  const dispatch = (out: SseMessage[]) => {
    if (hasData) out.push({ event: eventName || "message", data: dataLines.join("\n") });
    eventName = "";
    dataLines = [];
    hasData = false;
  };

  const processLine = (line: string, out: SseMessage[]) => {
    if (line === "") {
      dispatch(out);
      return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") eventName = value;
    else if (field === "data") {
      dataLines.push(value);
      hasData = true;
    }
  };

  const drain = (final: boolean): SseMessage[] => {
    const out: SseMessage[] = [];
    for (;;) {
      const cr = buffer.indexOf("\r");
      const lf = buffer.indexOf("\n");
      const index = cr === -1 ? lf : lf === -1 ? cr : Math.min(cr, lf);
      if (index === -1) break;
      // `\r` bo'lak oxirida — keyingi bo'lakda `\n` kelishi mumkin (`\r\n` bitta qator oxiri).
      if (buffer[index] === "\r" && index === buffer.length - 1 && !final) break;
      const line = buffer.slice(0, index);
      const skip = buffer[index] === "\r" && buffer[index + 1] === "\n" ? 2 : 1;
      buffer = buffer.slice(index + skip);
      processLine(line, out);
    }
    if (final) {
      if (buffer) processLine(buffer, out);
      buffer = "";
      dispatch(out);
    }
    return out;
  };

  return {
    push: (chunk) => {
      buffer += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
      return drain(false);
    },
    flush: () => {
      buffer += decoder.decode();
      return drain(true);
    },
  };
};
