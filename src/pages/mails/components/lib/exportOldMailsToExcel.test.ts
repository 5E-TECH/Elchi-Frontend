import { describe, expect, it } from "vitest";
import { buildOldMailsWorkbook, type OldMailsExportLabels } from "./exportOldMailsToExcel";

const labels: OldMailsExportLabels = {
  title: "Old mails report",
  generatedAt: "Generated at",
  no: "No.",
  mailId: "Mail ID",
  region: "Region",
  courier: "Courier",
  status: "Status",
  orders: "Orders",
  amount: "Amount",
  date: "Date",
  totalMails: "Total mails",
  totalOrders: "Total orders",
  totalAmount: "Total amount",
  currency: "UZS",
};

describe("buildOldMailsWorkbook", () => {
  it("renders report rows and aggregate values", () => {
    const workbook = buildOldMailsWorkbook([
      {
        id: "mail-1",
        region: "Toshkent",
        courier: "Bekzod",
        status: "Received",
        orders: 3,
        amount: 125000,
        createdAt: "2026-06-26T08:30:00.000Z",
      },
    ], labels);

    expect(workbook).toContain("mail-1");
    expect(workbook).toContain("Toshkent");
    expect(workbook).toContain("Total orders: 3");
    expect(workbook).toMatch(/Total amount: 125\s000 UZS/);
  });

  it("escapes values that Excel could treat as formulas", () => {
    const workbook = buildOldMailsWorkbook([
      {
        id: "=HYPERLINK(\"https://example.com\")",
        region: "<script>",
        courier: "",
        status: "Received",
        orders: 1,
        amount: 0,
        createdAt: "",
      },
    ], labels);

    expect(workbook).toContain("'=HYPERLINK(&quot;https://example.com&quot;)");
    expect(workbook).toContain("&lt;script&gt;");
  });
});
