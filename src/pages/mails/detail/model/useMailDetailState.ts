import { useState, useCallback } from "react";
import type { PostOrder } from "../../../../entities/mails";

// ─── Checkbox state ───────────────────────────────────────────────────────────
export const useMailDetailState = (orders: PostOrder[]) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const allSelected = orders.length > 0 && selectedIds.size === orders.length;
    const someSelected = selectedIds.size > 0 && selectedIds.size < orders.length;

    const toggleAll = useCallback(() => {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(orders.map((o) => o.id)));
        }
    }, [allSelected, orders]);

    const toggleOne = useCallback((id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    return {
        selectedIds,
        allSelected,
        someSelected,
        toggleAll,
        toggleOne,
        clearSelection,
    };
};
