import { ConfigProvider } from "antd";
import { useMemo, type ReactNode } from "react";
import { useParentLayerZ } from "../overlay";

/**
 * O'TISH DAVRI: v2 oyna ichidagi antd ro'yxatlari (`Select`, `DatePicker`, `Dropdown`, `Tooltip`) oyna
 * USTIDA ochilsin.
 *
 * antd suzuvchi panellari `body` ga portal qilinadi va z-index'i `zIndexPopupBase` (1000) + 50 — v2 oyna
 * qatlami (1200, `Z_LAYERS.overlay`) ostida qolardi (eski `Popup` 9999 da ham shunday edi). Oyna
 * ichida bazani joriy qatlam + 10 ga ko'taramiz: ro'yxat 1260 — oyna ustida, xabar (1300) ostida.
 * Sahifalar 4-bosqichda v2 `Select`/`DateRange` ga o'tgach bu o'ram kerak bo'lmaydi.
 */
export const AntdLayer = ({ children }: { children: ReactNode }) => {
  const layerZ = useParentLayerZ();
  const theme = useMemo(() => ({ token: { zIndexPopupBase: layerZ + 10 } }), [layerZ]);
  return <ConfigProvider theme={theme}>{children}</ConfigProvider>;
};
