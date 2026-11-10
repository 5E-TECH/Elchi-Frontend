import { describe, expect, it } from "vitest";
import { createSseParser } from "./sseParser";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("createSseParser — SSE o'quvchi (F7PWp6cK)", () => {
  it("gateway freymi: `event:` + `data:` + bo'sh qator — bitta hodisa", () => {
    const parser = createSseParser();
    expect(parser.push(bytes('event: meta\ndata: {"type":"meta","conversation_id":"7"}\n\n'))).toEqual([
      { event: "meta", data: '{"type":"meta","conversation_id":"7"}' },
    ]);
  });

  it("bir bo'lakda bir nechta hodisa; `: ping` izohi e'tiborsiz", () => {
    const parser = createSseParser();
    const out = parser.push(bytes(': ping\n\nevent: step\ndata: {"step":1}\n\n: ping\n\nevent: delta\ndata: {"text":"Salom"}\n\n'));
    expect(out).toEqual([
      { event: "step", data: '{"step":1}' },
      { event: "delta", data: '{"text":"Salom"}' },
    ]);
  });

  it("hodisa bo'laklar orasida bo'linsa — to'liq bo'lgach chiqadi", () => {
    const parser = createSseParser();
    expect(parser.push(bytes("event: del"))).toEqual([]);
    expect(parser.push(bytes('ta\ndata: {"te'))).toEqual([]);
    expect(parser.push(bytes('xt":"a"}\n'))).toEqual([]);
    expect(parser.push(bytes("\n"))).toEqual([{ event: "delta", data: '{"text":"a"}' }]);
  });

  it("ko'p baytli UTF-8 harf (o', «») ikki bo'lakka bo'linsa ham buzilmaydi", () => {
    const parser = createSseParser();
    const all = bytes('event: delta\ndata: {"text":"Kassa «to\'liq» — 286,4 mln so‘m"}\n\n');
    const cut = all.indexOf(0xe2) + 1; // «—» yoki «‘» ning o'rtasidan
    const first = parser.push(all.slice(0, cut));
    const second = parser.push(all.slice(cut));
    expect([...first, ...second]).toEqual([
      { event: "delta", data: '{"text":"Kassa «to\'liq» — 286,4 mln so‘m"}' },
    ]);
  });

  it("CRLF va yolg'iz CR qator oxiri; `\\r` bo'lak oxirida — keyingi `\\n` kutiladi", () => {
    const parser = createSseParser();
    expect(parser.push(bytes("event: step\r\ndata: 1\r"))).toEqual([]);
    expect(parser.push(bytes("\n\r\n"))).toEqual([{ event: "step", data: "1" }]);
    // Yolg'iz `\r` — qator oxiri (keyingi belgi `\n` emasligi ma'lum bo'lgach).
    expect(parser.push(bytes("data: 2\r\rdata: 3\r\r"))).toEqual([{ event: "message", data: "2" }]);
    expect(parser.flush()).toEqual([{ event: "message", data: "3" }]);
  });

  it("bir nechta `data:` qatori `\\n` bilan qo'shiladi; boshlang'ich bitta bo'shliq olinadi", () => {
    const parser = createSseParser();
    expect(parser.push("data:a\ndata:  b\n\n")).toEqual([{ event: "message", data: "a\n b" }]);
  });

  it("`data` siz hodisa chiqmaydi; noma'lum maydonlar (`id`, `retry`) e'tiborsiz", () => {
    const parser = createSseParser();
    expect(parser.push("event: meta\nid: 5\nretry: 1000\n\n")).toEqual([]);
    expect(parser.push("id: 6\ndata: x\n\n")).toEqual([{ event: "message", data: "x" }]);
  });

  it("`flush()` — oqim bo'sh qatorsiz yopilsa, oxirgi hodisa ham chiqadi", () => {
    const parser = createSseParser();
    expect(parser.push('event: done\ndata: {"answer":"ok"}')).toEqual([]);
    expect(parser.flush()).toEqual([{ event: "done", data: '{"answer":"ok"}' }]);
    expect(parser.flush()).toEqual([]);
  });
});
