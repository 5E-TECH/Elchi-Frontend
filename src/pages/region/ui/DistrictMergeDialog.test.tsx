import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../shared/api/api";
import { renderWithProviders } from "../../../test/test-utils";
import type { MergeDistrict, MergeErrorDetails, MergeState } from "../model/districtMerge";
import DistrictDeleteBlockedDialog from "./DistrictDeleteBlockedDialog";
import DistrictMergeDialog from "./DistrictMergeDialog";
import type { DistrictMergeController } from "./useDistrictMerge";

/**
 * DM-2 (tf324cXN, vsmpTweI): xato oynalari `data.reason` / `details` dan («Sabab», «Xabarni nusxalash»,
 * «Qayta urinish», «chala qoldi»), natijada «Ko'chirildi» — `moved_live`, «… ko'chadi» va «Bog'langan» sonlari.
 */
const BOZ: MergeDistrict = { id: "173", name: "Bo'z tumani", regionId: "2", regionName: "Andijon" };
const IZBOSKAN: MergeDistrict = {
  id: "28",
  name: "Izboskan tumani",
  regionId: "2",
  regionName: "Andijon",
};

const controller = (state: MergeState): DistrictMergeController => ({
  state,
  open: vi.fn(),
  select: vi.fn(),
  submit: vi.fn(),
  retry: vi.fn(),
  close: vi.fn(),
  refresh: vi.fn(),
});

const details = (patch: Partial<MergeErrorDetails> = {}): MergeErrorDetails => ({
  reason: "count_mismatch",
  kind: "orders",
  timeoutMs: null,
  mismatches: [{ kind: "orders", district: "target", expected: 1254, actual: 1255 }],
  manualFix: false,
  stranded: [],
  rolledBack: null,
  strandedOrderIds: [],
  traceId: "7d0c2a4e",
  ...patch,
});

const errorState = (status: number, patch: Partial<MergeErrorDetails> = {}): MergeState => ({
  phase: "error",
  source: BOZ,
  target: IZBOSKAN,
  status,
  details: details(patch),
});

/** `formatNumberLocalized` ming ajratgichi (bo'sh joy turi) — solishtirishda oddiy bo'sh joy. */
const plain = (text: string | null | undefined) => (text ?? "").replace(/\s/g, " ");

const renderDialog = (state: MergeState) => {
  const merge = controller(state);
  renderWithProviders(<DistrictMergeDialog merge={merge} candidates={[IZBOSKAN]} />);
  return merge;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DistrictMergeDialog — xato oynalari (tf324cXN)", () => {
  it("409 count_mismatch: «Birlashtirib bo'lmadi», «Sabab» sonlari, «Qayta urinish» — server matnisiz", async () => {
    const user = userEvent.setup();
    const merge = renderDialog(errorState(409));

    const dialog = screen.getByRole("alertdialog", { name: "Birlashtirib bo'lmadi" });
    expect(dialog).toHaveTextContent(
      "Birlashtirish bekor qilindi. Ko'chirilganlar Bo'z tumaniga qaytarildi, tuman o'chirilmadi.",
    );
    expect(dialog).toHaveTextContent("Bo'z tumani → Izboskan tumani");
    const reason = within(dialog).getByTestId("merge-error-reason");
    expect(plain(reason.textContent)).toContain(
      "Sonlar mos kelmadi — Izboskan tumanida buyurtmalar 1 255 ta, kutilgan 1 254 ta.",
    );
    expect(dialog).toHaveTextContent("Odatda shu payt yangi buyurtma qo'shilganda bo'ladi.");
    expect(dialog).not.toHaveTextContent(/409|HTTP/);

    await user.click(within(dialog).getByRole("button", { name: "Qayta urinish" }));
    expect(merge.retry).toHaveBeenCalledTimes(1);
  });

  it("«Xabarni nusxalash» — sabab, kod va trace_id buferga, xabar «Xabar nusxalandi»", async () => {
    const user = userEvent.setup();
    renderDialog(errorState(409));
    const dialog = screen.getByRole("alertdialog", { name: "Birlashtirib bo'lmadi" });

    await user.click(within(dialog).getByRole("button", { name: "Xabarni nusxalash" }));

    const copied = plain(await navigator.clipboard.readText());
    expect(copied).toContain("Birlashtirib bo'lmadi");
    expect(copied).toContain("Bo'z tumani (ID 173) → Izboskan tumani (ID 28)");
    expect(copied).toContain(
      "Sabab: Sonlar mos kelmadi — Izboskan tumanida buyurtmalar 1 255 ta, kutilgan 1 254 ta.",
    );
    expect(copied).toContain("Kod: count_mismatch · orders");
    expect(copied).toContain("trace_id: 7d0c2a4e");
    expect(await screen.findByText("Xabar nusxalandi")).toBeInTheDocument();
  });

  it("503 timeout: «Servis javob bermadi», «… 15 soniya ichida javob bermadi»", () => {
    renderDialog(
      errorState(503, { reason: "timeout", kind: "users", timeoutMs: 15000, mismatches: [] }),
    );
    const dialog = screen.getByRole("alertdialog", { name: "Servis javob bermadi" });
    expect(dialog).toHaveTextContent(
      "Birlashtirish to'xtatildi. Ko'chirilganlar Bo'z tumaniga qaytarildi",
    );
    expect(plain(within(dialog).getByTestId("merge-error-reason").textContent)).toContain(
      "Foydalanuvchilar ko'chirilmadi — servis 15 soniya ichida javob bermadi.",
    );
    expect(dialog).toHaveTextContent("Bir necha daqiqadan keyin qayta urinib ko'ring.");
    expect(within(dialog).getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
  });

  it("manual_fix: «Birlashtirish chala qoldi», qaytmaganlar ro'yxati, «Qayta urinish» o'rnida jurnal", () => {
    renderDialog(
      errorState(503, {
        reason: "timeout",
        kind: "users",
        timeoutMs: 15000,
        mismatches: [],
        manualFix: true,
        stranded: [
          { kind: "orders", districtId: "28", count: 14 },
          { kind: "users", districtId: null, count: null },
        ],
      }),
    );
    const dialog = screen.getByRole("alertdialog", { name: "Birlashtirish chala qoldi" });
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Qo'lda tuzatish kerak");
    const list = within(dialog).getByRole("list", { name: "Bo'z tumaniga qaytmaganlar" });
    const rows = within(list)
      .getAllByRole("listitem")
      .map((row) => plain(row.textContent));
    expect(rows).toEqual([
      "Buyurtmalar · 14 taIzboskan tumanida qoldi",
      "Foydalanuvchilar · ID'lar noma'lumJoyi aniqlanmadi — jurnalda tekshiring",
    ]);
    expect(dialog).toHaveTextContent(
      "«Tuman birlashtirish chala qoldi» yozuvi, Bo'z tumani (ID 173).",
    );
    expect(within(dialog).queryByRole("button", { name: "Qayta urinish" })).toBeNull();
    expect(
      within(dialog).getByRole("button", { name: "Faoliyat jurnalini ochish" }),
    ).toBeInTheDocument();
  });

  it("Z1c1sNPT: 409 — «Bo'z tumaniga qaytarildi» ro'yxati details.rolled_back_* dan, nusxada ham", async () => {
    const user = userEvent.setup();
    renderDialog(errorState(409, { rolledBack: { orders: 128, users: 6, branches: 1 } }));
    const dialog = screen.getByRole("alertdialog", { name: "Birlashtirib bo'lmadi" });

    expect(within(dialog).getByText("Bo'z tumaniga qaytarildi")).toBeInTheDocument();
    const list = within(dialog).getByRole("list", { name: "Bo'z tumaniga qaytarilganlar" });
    expect(within(list).getAllByRole("listitem").map((row) => plain(row.textContent))).toEqual([
      "Buyurtmalar128 ta",
      "Foydalanuvchilar6 ta",
      "Filiallar1 ta",
    ]);

    await user.click(within(dialog).getByRole("button", { name: "Xabarni nusxalash" }));
    expect(plain(await navigator.clipboard.readText())).toContain(
      "Bo'z tumaniga qaytarildi: buyurtmalar 128 ta · foydalanuvchilar 6 ta · filiallar 1 ta",
    );
  });

  it("Z1c1sNPT: 503 timeout — boshlanmagan qadamlar (0) chizilmaydi; hammasi 0 / eski javob — ro'yxat yo'q", () => {
    const { unmount } = renderWithProviders(
      <DistrictMergeDialog
        merge={controller(
          errorState(503, {
            reason: "timeout",
            kind: "users",
            timeoutMs: 15000,
            mismatches: [],
            rolledBack: { orders: 128, users: 0, branches: 0 },
          }),
        )}
        candidates={[IZBOSKAN]}
      />,
    );
    const dialog = screen.getByRole("alertdialog", { name: "Servis javob bermadi" });
    const list = within(dialog).getByRole("list", { name: "Bo'z tumaniga qaytarilganlar" });
    expect(within(list).getAllByRole("listitem").map((row) => plain(row.textContent))).toEqual(["Buyurtmalar128 ta"]);
    unmount();

    renderDialog(errorState(409, { rolledBack: { orders: 0, users: 0, branches: 0 } }));
    expect(screen.queryByRole("list", { name: "Bo'z tumaniga qaytarilganlar" })).toBeNull();
  });

  it("Z1c1sNPT: manual_fix — qaytmagan buyurtmalar raqamlari (stranded_order_ids) va «va yana N ta»", () => {
    renderDialog(
      errorState(503, {
        reason: "timeout",
        kind: "users",
        timeoutMs: 15000,
        mismatches: [],
        manualFix: true,
        stranded: [
          { kind: "orders", districtId: "28", count: 14 },
          { kind: "users", districtId: null, count: null },
        ],
        // «qaytarildi» ro'yxati «chala qoldi» oynasida chizilmaydi (maket `-error-manual`).
        rolledBack: { orders: 100, users: 0, branches: 0 },
        strandedOrderIds: ["7001", "7002"],
      }),
    );
    const dialog = screen.getByRole("alertdialog", { name: "Birlashtirish chala qoldi" });
    const list = within(dialog).getByRole("list", { name: "Bo'z tumaniga qaytmaganlar" });
    expect(within(list).getAllByRole("listitem").map((row) => plain(row.textContent))).toEqual([
      "Buyurtmalar · 14 taIzboskan tumanida qoldi: №7001, №7002 va yana 12 ta",
      "Foydalanuvchilar · ID'lar noma'lumJoyi aniqlanmadi — jurnalda tekshiring",
    ]);
    expect(within(dialog).queryByRole("list", { name: "Bo'z tumaniga qaytarilganlar" })).toBeNull();
  });

  it("unknown reason code: dialog without the «Sabab» row", () => {
    renderDialog(errorState(409, { reason: null, kind: null, mismatches: [] }));
    const dialog = screen.getByRole("alertdialog", { name: "Birlashtirib bo'lmadi" });
    expect(within(dialog).queryByTestId("merge-error-reason")).toBeNull();
  });

  it("an error without machine-readable details opens no dialog", () => {
    renderDialog({ phase: "error", source: BOZ, target: IZBOSKAN, status: 404, details: null });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("DistrictMergeDialog — sonlar (vsmpTweI, usage)", () => {
  it("natija: «Ko'chirildi» — moved (tirik), nol qator chizilmaydi", () => {
    renderDialog({
      phase: "result",
      source: BOZ,
      target: IZBOSKAN,
      outcome: {
        before: { orders: 1126, users: 13, branches: 1 },
        after: { orders: 1254, users: 19, branches: 1 },
        moved: { orders: 128, users: 6, branches: 0 },
      },
    });
    const dialog = screen.getByRole("dialog", { name: "Tumanlar birlashtirildi" });
    const moved = within(dialog).getByRole("list", { name: "Ko'chirildi" });
    expect(
      within(moved)
        .getAllByRole("listitem")
        .map((row) => plain(row.textContent)),
    ).toEqual(["Buyurtmalar128 ta", "Foydalanuvchilar6 ta"]);
    expect(
      within(dialog).getByRole("list", { name: "Izboskan tumanida endi" }),
    ).toBeInTheDocument();
  });

  it("tanlash: «Izboskan tumaniga ko'chadi» — GET district/:id/usage sonlari", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: { statusCode: 200, data: { orders: 128, users: 6, branches: 1 } },
    });
    renderDialog({ phase: "confirm", source: BOZ, targetId: IZBOSKAN.id });
    const dialog = screen.getByRole("dialog", { name: "Tumanni birlashtirish" });
    const list = await within(dialog).findByRole("list", { name: "Ko'chiriladiganlar" });
    expect(within(dialog).getByText("Izboskan tumaniga ko'chadi")).toBeInTheDocument();
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((row) => plain(row.textContent)),
    ).toEqual([
      "Buyurtmalar128 ta",
      "FoydalanuvchilarMijoz, kuryer va market6 ta",
      "Filiallar1 ta",
    ]);
    expect(get).toHaveBeenCalledWith("district/173/usage");
  });

  it("o'chirib bo'lmaydi: «Bog'langan» — 400 javobidagi data.usage", () => {
    renderWithProviders(
      <DistrictDeleteBlockedDialog
        district={BOZ}
        usage={{ orders: 128, users: 6, branches: 1 }}
        onClose={vi.fn()}
        onMerge={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("alertdialog", { name: "Bo'z tumanini o'chirib bo'lmaydi" });
    expect(within(dialog).getByText("Bog'langan")).toBeInTheDocument();
    expect(within(dialog).getByRole("list", { name: "Tumanga bog'langanlar" })).toHaveTextContent(
      "128 ta",
    );
  });
});
