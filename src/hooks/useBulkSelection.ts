import { useCallback, useEffect, useMemo, useState } from 'react';

interface ToggleOptions {
  index: number;
  shiftKey?: boolean;
}

export interface BulkSelectionState {
  selectedIds: Set<string>;
  selectedIdsArray: string[];
  selectedCount: number;
  allSelected: boolean;
  someSelected: boolean;
  toggleSelect: (id: string, options: ToggleOptions) => void;
  selectAll: () => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
}

export const useBulkSelection = <T,>(
  rows: T[],
  getRowId: (row: T) => string,
): BulkSelectionState => {
  const rowIds = useMemo(() => rows.map(getRowId).filter(Boolean), [rows, getRowId]);
  const rowIdSet = useMemo(() => new Set(rowIds), [rowIds]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }

      const next = new Set(Array.from(prev).filter((id) => rowIdSet.has(id)));
      return next.size === prev.size ? prev : next;
    });

    setAnchorIndex((prev) => {
      if (prev === null) {
        return prev;
      }
      return prev >= 0 && prev < rowIds.length ? prev : null;
    });
  }, [rowIdSet, rowIds.length]);

  const toggleSelect = useCallback((id: string, options: ToggleOptions) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const { index, shiftKey } = options;

      if (shiftKey && anchorIndex !== null && rowIds.length > 0) {
        const start = Math.min(anchorIndex, index);
        const end = Math.max(anchorIndex, index);

        for (let i = start; i <= end; i += 1) {
          const rowId = rowIds[i];
          if (rowId) {
            next.add(rowId);
          }
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });

    setAnchorIndex(options.index);
  }, [anchorIndex, rowIds]);

  const selectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === rowIds.length) {
        return new Set();
      }
      return new Set(rowIds);
    });
  }, [rowIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setAnchorIndex(null);
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const selectedIdsArray = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const selectedCount = selectedIds.size;
  const allSelected = rowIds.length > 0 && selectedIds.size === rowIds.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return {
    selectedIds,
    selectedIdsArray,
    selectedCount,
    allSelected,
    someSelected,
    toggleSelect,
    selectAll,
    clearSelection,
    isSelected,
  };
};
