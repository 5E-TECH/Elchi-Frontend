import type { PostOrder } from "../../../../entities/mails";
import i18n from "../../../../i18n";

export type PrintMode = "browser" | "pdf_100x60" | "thermal_80mm";

const escapeHtml = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

const getQrUrl = (token: string) => {
  const data = encodeURIComponent(token);
  // External QR generator (loads as <img> in about:blank print window).
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${data}`;
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

const openOrdersTablePrintWindow = (orders: PostOrder[]) => {
  const win = window.open("", "_blank", "noopener,width=1100,height=720");
  if (!win) return;

  const rows = orders.map((o, i) => {
    const customer = escapeHtml(o.customer?.name ?? i18n.t("mails:customerNumber", { id: o.customer_id }));
    const phone = escapeHtml(o.customer?.phone_number ?? "—");
    const district = escapeHtml(o.district?.name ?? "—");
    const market = escapeHtml(o.market?.name ?? "—");
    const deliver = o.where_deliver === "address" ? i18n.t("orders:deliveryToHome") : i18n.t("orders:deliveryToCenter");
    const total = new Intl.NumberFormat(i18n.language === "ru" ? "ru-RU" : i18n.language === "en" ? "en-US" : "uz-UZ").format(Number(o.total_price ?? 0));
    const createdAt = (() => {
      const raw = String(o.createdAt ?? "");
      const d = raw ? new Date(raw) : null;
      if (!d || Number.isNaN(d.getTime())) return escapeHtml(raw);
      return escapeHtml(
        d.toLocaleString("uz-UZ", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    })();

    return `
      <tr>
        <td>${i + 1}</td>
        <td>${customer}</td>
        <td>${phone}</td>
        <td>${district}</td>
        <td>${market}</td>
        <td>${escapeHtml(deliver)}</td>
        <td>${escapeHtml(total)} so'm</td>
        <td>${createdAt}</td>
      </tr>
    `;
  }).join("");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(i18n.t("orders:title"))}</title>
    <style>
      @page { size: A4; margin: 12mm; }
      html, body { margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; }
      #printBtn { position: fixed; top: 10px; right: 10px; z-index: 9999; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(0,0,0,.15); background: #111827; color: #fff; font-weight: 700; font-size: 12px; cursor: pointer; }
      @media print { #printBtn { display: none; } }
      h1 { font-size: 14pt; margin: 0 0 10px; }
      .meta { font-size: 9pt; opacity: .75; margin-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid; padding: 6px 8px; font-size: 9.5pt; vertical-align: top; }
      th { text-align: left; }
      tr { page-break-inside: avoid; }
    </style>
  </head>
  <body>
    <button id="printBtn" type="button">${escapeHtml(i18n.t("mails:printAction"))}</button>
    <h1>${escapeHtml(i18n.t("mails:selectedOrdersPrintTitle"))}</h1>
    <div class="meta">${escapeHtml(i18n.t("mails:countLabel", { count: orders.length }))}</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>${escapeHtml(i18n.t("orders:customer"))}</th>
          <th>${escapeHtml(i18n.t("common:phone"))}</th>
          <th>${escapeHtml(i18n.t("common:district"))}</th>
          <th>${escapeHtml(i18n.t("orders:market"))}</th>
          <th>${escapeHtml(i18n.t("orders:deliveryType"))}</th>
          <th>${escapeHtml(i18n.t("common:price"))}</th>
          <th>${escapeHtml(i18n.t("common:date"))}</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <script>
      ${printScript}
    </script>
  </body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
};

const openLabelsPrintWindow = (orders: PostOrder[]) => {
  const win = window.open("", "_blank", "noopener,width=900,height=720");
  if (!win) return;

  const sheets = orders.map((o) => {
    const customerName = escapeHtml(o.customer?.name ?? i18n.t("mails:customerNumber", { id: o.customer_id }));
    const phone = escapeHtml(o.customer?.phone_number ?? "—");
    const district = escapeHtml(o.district?.name ?? "—");
    const region = escapeHtml(o.district?.region?.name ?? o.region?.name ?? "");
    const market = escapeHtml(o.market?.name ?? "—");
    const address = escapeHtml(o.address ?? "");
    const whereDeliver = o.where_deliver === "address" ? i18n.t("orders:deliveryToHome") : i18n.t("orders:deliveryToCenter");

    const total = new Intl.NumberFormat(i18n.language === "ru" ? "ru-RU" : i18n.language === "en" ? "en-US" : "uz-UZ").format(Number(o.total_price ?? 0));
    const totalText = escapeHtml(`${total} ${i18n.t("orders:currency")}`);

    const fullAddress = [region, district ? `${district} tumani` : "", address].filter(Boolean).join(", ");

    const qrToken = o.qr_code_token ?? o.id;
    const qr = qrToken ? `<img class="qr" src="${getQrUrl(qrToken)}" alt="QR" />` : "";

    return `
      <div class="sheet">
        <div class="grid">
          <div class="qrWrap">
            ${qr}
          </div>
          <div class="content">
            <div class="title">${escapeHtml(market)}</div>
            <table class="t">
              <tr><td class="k">Buyurtma</td><td class="v">#${escapeHtml(o.id)}</td></tr>
              <tr><td class="k">Mijoz</td><td class="v">${customerName}</td></tr>
              <tr><td class="k">Telefon</td><td class="v">${phone}</td></tr>
              <tr><td class="k">Manzil</td><td class="v">${escapeHtml(fullAddress || "—")}</td></tr>
              <tr><td class="k">Yetkazish</td><td class="v">${escapeHtml(whereDeliver)}</td></tr>
              <tr><td class="k">Narx</td><td class="v">${totalText}</td></tr>
            </table>
          </div>
        </div>
      </div>
    `;
  }).join("");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(i18n.t("mails:printOptions.labelPdf.label"))}</title>
    <style>
      @page { size: 100mm 60mm; margin: 0; }
      html, body { margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; }
      #printBtn { position: fixed; top: 8px; right: 8px; z-index: 9999; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(0,0,0,.15); background: #111827; color: #fff; font-weight: 800; font-size: 12px; cursor: pointer; }
      @media print { #printBtn { display: none; } }
      .sheet { width: 100mm; height: 60mm; box-sizing: border-box; padding: 3.5mm; page-break-after: always; }
      .grid { display: grid; grid-template-columns: 22mm 1fr; gap: 3.5mm; align-items: start; }
      .qrWrap { width: 22mm; height: 22mm; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(0,0,0,.18); border-radius: 2mm; }
      .qr { width: 20.5mm; height: 20.5mm; image-rendering: pixelated; }
      .content { min-width: 0; }
      .title { font-size: 10pt; font-weight: 800; margin: 0 0 1.5mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .t { width: 100%; border-collapse: collapse; font-size: 7.7pt; }
      .t td { padding: 0.8mm 0; vertical-align: top; }
      .k { width: 18mm; opacity: .7; text-transform: uppercase; letter-spacing: .02em; font-weight: 700; font-size: 7pt; }
      .v { font-weight: 700; word-break: break-word; }
      .t tr + tr td { border-top: 1px solid rgba(0,0,0,.08); }
    </style>
  </head>
  <body>
    <button id="printBtn" type="button">${escapeHtml(i18n.t("mails:printAction"))}</button>
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
  if (mode === "pdf_100x60") return openLabelsPrintWindow(orders);
  if (mode === "thermal_80mm") return openThermalPrintWindow(orders);
  return openOrdersTablePrintWindow(orders);
};
