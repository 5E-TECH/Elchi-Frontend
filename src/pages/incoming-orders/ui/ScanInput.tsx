// dizayn-v2: superadmin-neworders-incoming-scan, admin-neworders-incoming-scan, manager-new-orders-incoming-scan
import { memo, useState, type FormEvent, type Ref } from "react";
import { ScanLine } from "lucide-react";
import { TextInput } from "../../../shared/ui/primitives";

type Props = {
  /** Sahifa maydonga fokusni qaytaradi (ochilganda, qabuldan keyin). */
  inputRef: Ref<HTMLInputElement>;
  /** Enter (skaner oxirida o'zi bosadi) — xom matn bilan. */
  onScan: (raw: string) => void;
  placeholder: string;
  label: string;
};

/**
 * SKANER MAYDONI (maket `.el-search` + `.el-input-lg`, `ScanLine`).
 *
 * USB skaner klaviatura sifatida ishlaydi: kodni harf-harf "yozadi" va oxirida Enter bosadi.
 * Matn holati ATAYLAB shu komponentning o'zida: har harf faqat maydonni qayta chizadi, sahifadagi
 * yuzlab qatorli ro'yxatni emas (250 posilkali qopda har skan ~20 harf — ro'yxat har harfda
 * qayta chizilsa skaner sekinlashardi). Sahifa faqat Enter da (`onScan`) xabardor bo'ladi.
 *
 * Yuborishda qiymat DOM'dagi maydondan olinadi: skaner juda tez yozganda React holati oxirgi
 * harfdan orqada qolsa ham kod to'liq o'qiladi. Yuborilgach maydon tozalanadi (keyingi skanga tayyor).
 */
const ScanInput = ({ inputRef, onScan, placeholder, label }: Props) => {
  const [value, setValue] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const field = event.currentTarget.elements.namedItem("scan");
    const raw = field instanceof HTMLInputElement ? field.value : value;
    onScan(raw);
    setValue("");
  };

  return (
    <form className="min-w-0" onSubmit={submit}>
      <TextInput
        ref={inputRef}
        name="scan"
        size="lg"
        icon={ScanLine}
        value={value}
        onValueChange={setValue}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
      />
    </form>
  );
};

export default memo(ScanInput);
