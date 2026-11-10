// dizayn-v2: superadmin-ai-assistant
import { Fragment, useMemo, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import { inlineText, parseMarkdown, type MdBlock, type MdInline } from "../../lib/miniMarkdown";
import { DataTable, type DataTableColumn } from "../primitives";

/**
 * AI JAVOBI MATNI — `shared/lib/miniMarkdown.ts` daraxtidan faqat React tugunlari (HTML kiritilmaydi, havola va
 * rasm — matn). Maket `superadmin-ai-assistant` javob kartasi: paragraf 15/1.6, sarlavha `.el-h3`, ro'yxat,
 * jadval — `DataTable density="compact"` ramkada (telefonda kartalar), qalin — `.el-strong`.
 */

export type MiniMarkdownProps = {
  source: string;
  className?: string;
};

const renderInline = (nodes: readonly MdInline[], keyPrefix = "i"): ReactNode[] =>
  nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case "text":
        return <Fragment key={key}>{node.text}</Fragment>;
      case "code":
        return (
          <span key={key} className="rounded-md bg-sunken px-1 py-px">
            {node.text}
          </span>
        );
      case "break":
        return <br key={key} />;
      case "strong":
        return (
          <strong key={key} className="font-semibold text-text">
            {renderInline(node.children, key)}
          </strong>
        );
      case "em":
        return (
          <em key={key} className="italic">
            {renderInline(node.children, key)}
          </em>
        );
    }
  });

type TableRow = { cells: MdInline[][] };

const ALIGN_CLASS = { start: "text-left", end: "text-right", center: "text-center" } as const;

const MarkdownTable = ({ block }: { block: Extract<MdBlock, { type: "table" }> }) => {
  const rows = useMemo<TableRow[]>(() => block.rows.map((cells) => ({ cells })), [block.rows]);
  const columns = useMemo<DataTableColumn<TableRow>[]>(
    () =>
      block.header.map((header, col) => ({
        id: `c${col}`,
        header: renderInline(header, `h${col}`),
        align: block.align[col] === "end" ? "end" : "start",
        cellClassName: cx(block.align[col] === "center" && ALIGN_CLASS.center, block.align[col] === "end" && "whitespace-nowrap"),
        cell: (row) => renderInline(row.cells[col] ?? [], `r${col}`),
      })),
    [block.align, block.header],
  );
  const label = block.header.map((cell) => inlineText(cell)).join(", ");

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border">
      <DataTable
        rows={rows}
        columns={columns}
        density="compact"
        label={label}
        getRowKey={(_, index) => String(index)}
        renderCard={(row) => (
          <div className="flex min-w-0 flex-col gap-1 px-3.5 py-3">
            <span className="min-w-0 font-semibold text-text wrap-break-word">
              {renderInline(row.cells[0] ?? [], "card-title")}
            </span>
            {block.header.slice(1).map((header, offset) => {
              const col = offset + 1;
              const cell = row.cells[col] ?? [];
              if (!inlineText(cell).trim()) return null;
              return (
                <span key={col} className="flex min-w-0 items-baseline justify-between gap-3 text-[13px]">
                  <span className="min-w-0 text-text-muted">{renderInline(header, `ch${col}`)}</span>
                  <span className="shrink-0 text-right text-text">{renderInline(cell, `cv${col}`)}</span>
                </span>
              );
            })}
          </div>
        )}
      />
    </div>
  );
};

const renderBlock = (block: MdBlock, index: number): ReactNode => {
  const key = `b-${index}`;
  switch (block.type) {
    case "paragraph":
      return (
        <p key={key} className="leading-[1.6] wrap-break-word">
          {renderInline(block.children, key)}
        </p>
      );
    case "heading":
      return (
        <h3 key={key} className="text-base font-bold text-text">
          {renderInline(block.children, key)}
        </h3>
      );
    case "list": {
      const items = block.items.map((item, itemIndex) => (
        <li key={`${key}-${itemIndex}`} className="pl-1 leading-[1.6] wrap-break-word">
          {renderInline(item, `${key}-${itemIndex}`)}
        </li>
      ));
      return block.ordered ? (
        <ol key={key} start={block.start} className="flex list-decimal flex-col gap-1 pl-6">
          {items}
        </ol>
      ) : (
        <ul key={key} className="flex list-disc flex-col gap-1 pl-6">
          {items}
        </ul>
      );
    }
    case "table":
      return <MarkdownTable key={key} block={block} />;
    case "rule":
      return <hr key={key} className="border-0 border-t border-border" />;
    case "code":
      return (
        <p key={key} className="rounded-xl bg-sunken px-3.5 py-3 leading-[1.6] whitespace-pre-wrap wrap-break-word">
          {block.text}
        </p>
      );
  }
};

export const MiniMarkdown = ({ source, className }: MiniMarkdownProps) => {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  return <div className={cx("flex min-w-0 flex-col gap-3 text-[15px] text-text", className)}>{blocks.map(renderBlock)}</div>;
};

export default MiniMarkdown;
