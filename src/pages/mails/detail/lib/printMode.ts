import type { PostOrder } from "../../../../entities/mails";
import i18n from "../../../../i18n";
import {
  openOrdersLabelBrowserPrint,
  openOrdersLabelPdf,
} from "../../../new_orders/components/lib/printLabelPdf";
import type { ApiOrder } from "../../../new_orders/components/OrderCard";

export type PrintMode = "browser" | "pdf_100x60" | "thermal_80mm";

const toApiOrder = (order: PostOrder): ApiOrder => ({
  id: order.id,
  qr_code_token: order.qr_code_token,
  status: order.status,
  where_deliver: order.where_deliver,
  total_price: order.total_price,
  paid_amount: order.paid_amount,
  to_be_paid: order.to_be_paid,
  createdAt: order.createdAt,
  comment: order.comment,
  address: order.address,
  items: ((order.items as Array<{
    id: string;
    quantity: number;
    product?: { id: string; name: string; image_url: string | null };
  }>) ?? []).map((item) => ({
    id: item.id,
    quantity: item.quantity,
    product: item.product ?? {
      id: "",
      name: "Mahsulot",
      image_url: null,
    },
  })),
  customer: {
    id: order.customer?.id ?? order.customer_id,
    name: order.customer?.name ?? "",
    phone_number: order.customer?.phone_number ?? "",
    district: (order.customer as PostOrder["customer"] & { district?: { name: string } } | undefined)?.district,
    region: (order.customer as PostOrder["customer"] & { region?: { name: string } } | undefined)?.region,
  },
  district: order.district,
  region: order.region,
});

const escapeHtml = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

const printScript = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const raf = () => new Promise((r) => requestAnimationFrame(() => r(null)));
  const waitImages = () => {
    const imgs = Array.from(document.images || []);
    if (imgs.length === 0) return Promise.resolve();
    return Promise.all(imgs.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    }));
  };

  const triggerPrint = async () => {
    try {
      // Wait a bit, but don't hang forever.
      await Promise.race([
        (async () => {
          if (document.fonts && document.fonts.ready) await document.fonts.ready;
          await waitImages();
          await raf();
          await raf();
        })(),
        sleep(1200),
      ]);
    } catch {}

    try { window.focus(); } catch {}
    try { window.print(); } catch {}
  };

  window.addEventListener('load', () => { void triggerPrint(); });
  document.getElementById('printBtn')?.addEventListener('click', () => { void triggerPrint(); });
  window.onafterprint = () => window.close();
`;

const openThermalPrintWindow = (orders: PostOrder[]) => {
  const win = window.open("", "_blank", "noopener,width=520,height=720");
  if (!win) return;

  const sheets = orders.map((o) => {
    const customerName = escapeHtml(o.customer?.name ?? i18n.t("mails:customerNumber", { id: o.customer_id }));
    const phone = escapeHtml(o.customer?.phone_number ?? "—");
    const district = escapeHtml(o.district?.name ?? "—");
    const region = escapeHtml(o.district?.region?.name ?? o.region?.name ?? "");
    const address = escapeHtml(o.address ?? "");
    const market = escapeHtml(o.market?.name ?? "—");
    const deliver = o.where_deliver === "address" ? i18n.t("orders:deliveryToHome") : i18n.t("orders:deliveryToCenter");

    const total = new Intl.NumberFormat(i18n.language === "ru" ? "ru-RU" : i18n.language === "en" ? "en-US" : "uz-UZ").format(Number(o.total_price ?? 0));
    const fullAddress = [region, district ? `${district} tumani` : "", address].filter(Boolean).join(", ");

    return `
      <section class="ticket">
        <div class="title">Elchi</div>
        <div class="row"><span>${escapeHtml(i18n.t("orders:create"))}</span><strong>#${escapeHtml(o.id)}</strong></div>
        <div class="row"><span>${escapeHtml(i18n.t("orders:deliveryType"))}</span><strong>${escapeHtml(deliver)}</strong></div>
        <div class="hr"></div>
        <div class="row"><span>${escapeHtml(i18n.t("orders:customer"))}</span><strong>${customerName}</strong></div>
        <div class="row"><span>${escapeHtml(i18n.t("common:phone"))}</span><strong>${phone}</strong></div>
        <div class="row"><span>${escapeHtml(i18n.t("common:address"))}</span><strong>${escapeHtml(fullAddress || "—")}</strong></div>
        <div class="row"><span>${escapeHtml(i18n.t("orders:market"))}</span><strong>${market}</strong></div>
        <div class="hr"></div>
        <div class="row total"><span>${escapeHtml(i18n.t("common:total"))}</span><strong>${escapeHtml(total)} ${escapeHtml(i18n.t("orders:currency"))}</strong></div>
      </section>
    `;
  }).join("");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Thermal</title>
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      html, body { margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; }
      #printBtn { position: fixed; top: 8px; right: 8px; z-index: 9999; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(0,0,0,.15); background: #111827; color: #fff; font-weight: 800; font-size: 12px; cursor: pointer; }
      @media print { #printBtn { display: none; } }
      .ticket { width: 72mm; margin: 0 auto; page-break-after: always; }
      .title { text-align: center; font-weight: 800; font-size: 14pt; margin-bottom: 3mm; }
      .row { display: flex; justify-content: space-between; gap: 4mm; font-size: 9.5pt; line-height: 1.25; margin: 1mm 0; }
      .row span { opacity: .75; }
      .row strong { text-align: right; max-width: 48mm; word-break: break-word; }
      .hr { height: 1px; background: currentColor; opacity: .2; margin: 2.5mm 0; }
      .total { font-size: 11pt; }
    </style>
  </head>
  <body>
    <button id="printBtn" type="button">Print / Save PDF</button>
    ${sheets}
    <script>
      ${printScript}
    </script>
  </body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
};

export const printOrders = (mode: PrintMode, orders: PostOrder[]) => {
  if (orders.length === 0) return;
  const printableOrders = orders.map(toApiOrder);
  if (mode === "pdf_100x60") return void openOrdersLabelPdf(printableOrders);
  if (mode === "thermal_80mm") return openThermalPrintWindow(orders);
  return openOrdersLabelBrowserPrint(printableOrders);
};
