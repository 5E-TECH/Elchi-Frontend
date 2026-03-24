import type { PostOrder } from "../../../../entities/mails";

export type PrintMode = "browser" | "pdf_100x60" | "thermal_80mm";

const escapeHtml = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

const openOrdersTablePrintWindow = (orders: PostOrder[]) => {
  const win = window.open("", "_blank", "noopener,noreferrer,width=1100,height=720");
  if (!win) return;

  const rows = orders.map((o, i) => {
    const customer = escapeHtml(o.customer?.name ?? "—");
    const phone = escapeHtml(o.customer?.phone_number ?? "—");
    const district = escapeHtml(o.district?.name ?? "—");
    const market = escapeHtml(o.market?.name ?? "—");
    const deliver = o.where_deliver === "address" ? "Manzilga" : "Markazga";
    const total = new Intl.NumberFormat("uz-UZ").format(Number(o.total_price ?? 0));
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
    <title>Buyurtmalar</title>
    <style>
      @page { size: A4; margin: 12mm; }
      html, body { margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; }
      h1 { font-size: 14pt; margin: 0 0 10px; }
      .meta { font-size: 9pt; opacity: .75; margin-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid; padding: 6px 8px; font-size: 9.5pt; vertical-align: top; }
      th { text-align: left; }
      tr { page-break-inside: avoid; }
    </style>
  </head>
  <body>
    <h1>Tanlangan buyurtmalar</h1>
    <div class="meta">Soni: ${orders.length}</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Mijoz</th>
          <th>Telefon</th>
          <th>Tuman</th>
          <th>Market</th>
          <th>Yetkazish</th>
          <th>Narx</th>
          <th>Sana</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <script>
      window.addEventListener('load', () => {
        setTimeout(() => {
          window.focus();
          window.print();
        }, 50);
      });
      window.onafterprint = () => window.close();
    </script>
  </body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
};

const openLabelsPrintWindow = (orders: PostOrder[]) => {
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=720");
  if (!win) return;

  const sheets = orders.map((o) => {
    const customerName = escapeHtml(o.customer?.name ?? "—");
    const phone = escapeHtml(o.customer?.phone_number ?? "—");
    const district = escapeHtml(o.district?.name ?? "—");
    const region = escapeHtml(o.district?.region?.name ?? o.region?.name ?? "");
    const market = escapeHtml(o.market?.name ?? "—");
    const address = escapeHtml(o.address ?? "");
    const whereDeliver = o.where_deliver === "address" ? "Manzilga" : "Markazga";

    const total = new Intl.NumberFormat("uz-UZ").format(Number(o.total_price ?? 0));
    const totalText = escapeHtml(`${total} so'm`);

    const fullAddress = [region, district ? `${district} tumani` : "", address].filter(Boolean).join(", ");

    return `
      <div class="sheet">
        <div class="top">
          <div class="id">Buyurtma #${escapeHtml(o.id)}</div>
          <div class="meta">
            <div class="small">${escapeHtml(whereDeliver)}</div>
            <div class="small">${totalText}</div>
          </div>
        </div>
        <div class="divider"></div>
        <div class="row">
          <div class="col">
            <div class="lbl">Mijoz</div>
            <div class="val">${customerName}</div>
          </div>
          <div class="col">
            <div class="lbl">Telefon</div>
            <div class="val">${phone}</div>
          </div>
        </div>
        <div class="row">
          <div class="col">
            <div class="lbl">Manzil</div>
            <div class="val">${escapeHtml(fullAddress || "—")}</div>
          </div>
        </div>
        <div class="row">
          <div class="col">
            <div class="lbl">Market</div>
            <div class="val">${market}</div>
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
    <title>Labels</title>
    <style>
      @page { size: 100mm 60mm; margin: 0; }
      html, body { margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; }
      .sheet { width: 100mm; height: 60mm; box-sizing: border-box; padding: 4mm; page-break-after: always; }
      .top { display: flex; justify-content: space-between; gap: 6mm; }
      .id { font-size: 12pt; font-weight: 700; }
      .meta { font-size: 9pt; line-height: 1.25; }
      .row { display: flex; gap: 6mm; margin-top: 3mm; }
      .col { flex: 1; min-width: 0; }
      .lbl { font-size: 7.5pt; letter-spacing: .02em; text-transform: uppercase; opacity: .7; }
      .val { font-size: 10pt; font-weight: 600; word-break: break-word; }
      .small { font-size: 9pt; font-weight: 600; }
      .divider { height: 1px; opacity: .18; background: currentColor; margin: 3mm 0; }
    </style>
  </head>
  <body>
    ${sheets}
    <script>
      window.addEventListener('load', () => {
        setTimeout(() => {
          window.focus();
          window.print();
        }, 50);
      });
      window.onafterprint = () => window.close();
    </script>
  </body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
};

const openThermalPrintWindow = (orders: PostOrder[]) => {
  const win = window.open("", "_blank", "noopener,noreferrer,width=520,height=720");
  if (!win) return;

  const sheets = orders.map((o) => {
    const customerName = escapeHtml(o.customer?.name ?? "—");
    const phone = escapeHtml(o.customer?.phone_number ?? "—");
    const district = escapeHtml(o.district?.name ?? "—");
    const region = escapeHtml(o.district?.region?.name ?? o.region?.name ?? "");
    const address = escapeHtml(o.address ?? "");
    const market = escapeHtml(o.market?.name ?? "—");
    const deliver = o.where_deliver === "address" ? "Manzilga" : "Markazga";

    const total = new Intl.NumberFormat("uz-UZ").format(Number(o.total_price ?? 0));
    const fullAddress = [region, district ? `${district} tumani` : "", address].filter(Boolean).join(", ");

    return `
      <section class="ticket">
        <div class="title">Elchi</div>
        <div class="row"><span>Buyurtma</span><strong>#${escapeHtml(o.id)}</strong></div>
        <div class="row"><span>Yetkazish</span><strong>${escapeHtml(deliver)}</strong></div>
        <div class="hr"></div>
        <div class="row"><span>Mijoz</span><strong>${customerName}</strong></div>
        <div class="row"><span>Telefon</span><strong>${phone}</strong></div>
        <div class="row"><span>Manzil</span><strong>${escapeHtml(fullAddress || "—")}</strong></div>
        <div class="row"><span>Market</span><strong>${market}</strong></div>
        <div class="hr"></div>
        <div class="row total"><span>Jami</span><strong>${escapeHtml(total)} so'm</strong></div>
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
    ${sheets}
    <script>
      window.addEventListener('load', () => {
        setTimeout(() => {
          window.focus();
          window.print();
        }, 50);
      });
      window.onafterprint = () => window.close();
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
