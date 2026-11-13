import { test, type Page, type Route } from "@playwright/test";

/**
 * BE-B e2e yordamchisi — avtomatik yopilgan ASOSIY kassa smenasiga karta rasmini 24 soat ichida keyin yuklash
 * (backend PR #629). Soxta gateway:
 *  - `GET finance/shift/31/report` — avto-yopilgan smena: 4 karta — «Asosiy karta» rasmi bor (`uploaded`), «Humo virtual»
 *    rasm kutilmoqda (`pending`, `can_upload_late` — faqat superadmin / admin), «Visa virtual» — `missing`, «Hisob raqam»
 *    — `not_required`; muddat — `closed_at + 24 soat` (hozirdan ~20 soat keyin);
 *  - `POST finance/shift/31/accounts/:card_id/late-photo` — multipart maydon nomlari va matn qiymatlari yoziladi
 *    (`uploads`); `state.nextError` bo'lsa — shu xato (backend konverti: `statusCode`, `message`, `code`, `deadline`) va
 *    hisobotda tugma yo'qoladi (backend `can_upload_late: false` deydi), aks holda 201 — qator yangilanadi;
 *  - boshqa yozish so'rovlari taqiqlangan (`leaked`), qolgan GET'lar bo'sh ro'yxat.
 */
const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4173").origin;
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

/** 180 × 320 PNG — telefon skrinshotiga o'xshash bloklar (brauzerda haqiqiy kichraytirish yo'lidan o'tadi). */
export const SCREENSHOT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAALQAAAFACAIAAACa28HeAAACnUlEQVR42u3coQ2AMBRF0W5SRcI+HYEl0B2CmTBohkATEhS2AkENKeEkd4LXI5sf9uOUbgsmEByCQ3AIDsEhOASH4BAcgkOCQ3AIDsEhOASH4BAcgkNwSHAIDsEhOASH4BAcgkNwFMU+qfHgEByCQ3AIDsEhOOCAAw444IADDjjgEByCQ3AIDsEhOOCAAw444IADDjjgEByCQ3AIDsEhOAQHHHDAAYcTDIJDcAgOwSE4BIfgEByCQ4JDcAgOwSE4BIfgEByCQ3AIDgkOwSE4BIfgEByCQ3AIDsFR25gnPQwOwQEHHHDAAQccccMABBxxwwAEHHHDAAQcccAgOTw4HHHDAAQcccMABBxxwwAEHHHDAAQccgkNwwAEHHHDAAQcccMABBxxwwAGHEwyCQ3AIDsEhOKwgOASH4BAcgkNwCA7BITgEhwSH4BAcgkNfw9ENmxoPDsEhOASH4BAcggMOOOCAAw444IADDsEhOASH4BAcggMOOOCAAw444IADDsEhOASH4BAcgkNwwAEHHHDAAQccgkNwCA7BITgEh+CAAw444HCkVnAIDsEhOASH4BAcgkNwCA4JDsEhOASH4BAcgkNwCA7BUdu8rHohOASH4BAcXg4OOOCAAw444IADDjjggAMOOASH4BAcgkP+c0hwCA7BITgEh+AQHIJDcAgOwSHBITgEh+AQHIJDcAgOwSE4JDgEh+AQHIJDcAgOwSE4BIcEh+AQHIJDcAgOwSE4BIfgEBxWEByCQ3AIDsEhOASH4BAcgkOCQ3AIDsEhOASH4BAcgkNwSHAIDsEhOASH4BAcgkNwCA7BYQXBITgEh+AQHIJDcAgOwSE4JDgEh+AQHIJDcAgOwSE4BIcEh+AQHIJDcAgOwSE4BIfg0O+7AOY64t4Oj2ssAAAAAElFTkSuQmCC",
  "base64",
);

export type LatePhotoUpload = { cardId: string; fields: string[]; values: Record<string, string>; photoType: string | null };

/** Multipart tanasi: maydon nomlari tartibi, matn qiymatlari va fayl turi (`Content-Type`). */
const parseMultipart = (body: Buffer, contentType: string) => {
  const boundary = /boundary=([^;]+)/.exec(contentType)?.[1]?.replace(/^"|"$/g, "") ?? "";
  const text = body.toString("latin1");
  const fields: string[] = [];
  const values: Record<string, string> = {};
  let photoType: string | null = null;
  for (const part of text.split(`--${boundary}`)) {
    const name = /name="([^"]+)"/.exec(part)?.[1];
    if (!name) continue;
    fields.push(name);
    const [head, ...rest] = part.split("\r\n\r\n");
    if (/filename="/.test(head)) {
      photoType = /Content-Type:\s*([^\r\n]+)/i.exec(head)?.[1]?.trim() ?? null;
    } else {
      values[name] = Buffer.from(rest.join("\r\n\r\n").replace(/\r\n$/, ""), "latin1").toString("utf8");
    }
  }
  return { fields, values, photoType };
};

const card = (id: string, name: string, bank: string, last4: string) => ({
  id,
  name,
  bank_name: bank,
  last4,
  kind: "virtual_card",
  card_network: null,
  is_default: id === "1",
});

export type LatePhotoError = { status: number; body: Record<string, unknown> };

export const mockShiftLatePhoto = async (page: Page, role: "superadmin" | "manager" = "superadmin") => {
  const origin = appOrigin();
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

  const now = Date.now();
  const closedAt = new Date(now - 4 * 3_600_000).toISOString();
  const deadline = new Date(now + 20 * 3_600_000).toISOString();
  const privileged = role === "superadmin";
  const base = {
    shift_id: "31",
    entered_balance: null,
    difference: null,
    has_photo: false,
    photo_url: null,
    photo_uploaded_at: null,
    ai_status: "not_required",
    ai_read_balance: null,
    ai_entered_ok: null,
    comment: null,
    comment_required: false,
    photo_required_snap: true,
    ai_enabled_snap: true,
    late_upload_deadline: deadline,
    late_uploaded: false,
    can_upload_late: false,
  };
  const state = {
    accounts: [
      {
        ...base,
        id: "1",
        card_id: "1",
        card: card("1", "Asosiy karta", "Agrobank", "1234"),
        expected_balance: 2_140_000,
        entered_balance: 2_140_000,
        difference: 0,
        has_photo: true,
        photo_url: "https://files.example/signed/1",
        photo_uploaded_at: new Date(now - 5 * 3_600_000).toISOString(),
        ai_status: "match",
        ai_read_balance: 2_140_000,
        ai_entered_ok: true,
        photo_status: "uploaded",
        can_upload_late: privileged,
      },
      {
        ...base,
        id: "2",
        card_id: "2",
        card: card("2", "Humo virtual", "Hamkorbank", "4417"),
        expected_balance: 1_850_000,
        photo_status: "pending",
        can_upload_late: privileged,
      },
      {
        ...base,
        id: "3",
        card_id: "3",
        card: card("3", "Visa virtual", "Kapitalbank", "0932"),
        expected_balance: 935_000,
        photo_status: "pending",
        can_upload_late: privileged,
      },
      {
        ...base,
        id: "4",
        card_id: "4",
        card: card("4", "Hisob raqam", "Ipoteka bank", "2205"),
        expected_balance: 1_450_000,
        photo_required_snap: false,
        ai_enabled_snap: false,
        photo_status: "not_required",
        can_upload_late: privileged,
      },
    ] as Array<Record<string, unknown>>,
    uploads: [] as LatePhotoUpload[],
    nextError: null as LatePhotoError | null,
    reportReads: 0,
    leaked: [] as string[],
  };

  const report = () => ({
    shift: {
      id: "31",
      status: "closed",
      opened_at: new Date(now - 13 * 3_600_000).toISOString(),
      closed_at: closedAt,
      opened_by_name: "Shodiyor Ergashev",
      closed_by_name: null,
    },
    cashbox_type: "main",
    close_reason: "auto",
    closed_by_system: true,
    auto_close: { closed_at: closedAt, label: null },
    report: privileged ? { status: "sent", round: 1, file_format: "pdf", has_file: false, file_url: null } : null,
    deliveries: [],
    cash: {
      opening_balance: 11_270_000,
      total_income: 6_970_000,
      total_expense: 0,
      expected_balance: 18_240_000,
      closing_balance: null,
      discrepancy: null,
    },
    card: {
      opening_balance: 6_375_000,
      total_income: 0,
      total_expense: 0,
      expected_balance: 6_375_000,
      closing_balance: null,
      discrepancy: null,
    },
    accounts: state.accounts,
    accounts_summary: null,
    operations: [{ operation_type: "income", payment_method: "cash", count: 4, total: 6_970_000 }],
  });

  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");

    if (path === "auth/my-profile") {
      return reply(
        route,
        wrap(
          role === "manager"
            ? {
                id: "77",
                role: "manager",
                name: "Ravshan Ortiqov",
                status: "active",
                branch_id: "16",
                branch_type: "HQ",
                branch: { id: "16", name: "Toshkent HQ", type: "HQ" },
              }
            : { id: "42", role: "superadmin", name: "Bosh admin", status: "active" },
        ),
      );
    }
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 0 }));
    const late = /^finance\/shift\/31\/accounts\/(\d+)\/late-photo$/.exec(path);
    if (late && request.method() === "POST") {
      const cardId = late[1];
      const parsed = parseMultipart(request.postDataBuffer() ?? Buffer.alloc(0), request.headers()["content-type"] ?? "");
      state.uploads.push({ cardId, ...parsed });
      if (state.nextError) {
        const error = state.nextError;
        state.nextError = null;
        // Backend: muddat o'tgan / avto-yopilmagan — endi hech kim yuklay olmaydi.
        state.accounts = state.accounts.map((row) => ({ ...row, can_upload_late: false }));
        return reply(route, { statusCode: error.status, ...error.body }, error.status);
      }
      const entered = Number(parsed.values.entered_balance);
      state.accounts = state.accounts.map((row) => {
        if (row.card_id !== cardId) return row;
        const expected = Number(row.expected_balance);
        return {
          ...row,
          entered_balance: entered,
          difference: entered - expected,
          has_photo: true,
          photo_url: `https://files.example/signed/${cardId}-late`,
          photo_uploaded_at: new Date().toISOString(),
          ai_status: "pending",
          comment: parsed.values.comment ?? null,
          comment_required: entered !== expected,
          confirmed_by: "42",
          photo_status: "uploaded",
          late_uploaded: true,
        };
      });
      const updated = state.accounts.find((row) => row.card_id === cardId);
      return reply(route, { statusCode: 201, message: "Shift account late photo uploaded", data: updated }, 201);
    }
    if (request.method() !== "GET") {
      state.leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    if (path === "finance/shift/31/report") {
      state.reportReads += 1;
      return reply(route, wrap(report()));
    }
    return reply(route, wrap({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }));
  });

  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return state;
};
