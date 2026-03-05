import React, { useEffect, useMemo, useRef, useState } from 'react';

interface BulkSelectableTableProps<T> {
  rows: T[];
  columns: string[];
  rowKey: (row: T) => string;
  renderRow: (row: T) => React.ReactNode;
  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onToggleRow: (rowId: string, rowIndex: number, shiftKey: boolean) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  rowHeight?: number;
  maxBodyHeight?: number;
  virtualizationThreshold?: number;
}

const BulkSelectableTable = <T extends unknown>({
  rows,
  columns,
  rowKey,
  renderRow,
  selectedIds,
  allSelected,
  someSelected,
  onToggleAll,
  onToggleRow,
  isLoading = false,
  emptyMessage = 'No records found.',
  rowHeight = 72,
  maxBodyHeight = 560,
  virtualizationThreshold = 120,
}: BulkSelectableTableProps<T>) => {
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const isVirtualized = rows.length >= virtualizationThreshold;
  const overscan = 8;
  const visibleCount = Math.ceil(maxBodyHeight / rowHeight) + overscan * 2;

  const windowedRows = useMemo(() => {
    if (!isVirtualized) {
      return {
        startIndex: 0,
        endIndex: rows.length,
        visibleRows: rows,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
      };
    }

    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const endIndex = Math.min(rows.length, startIndex + visibleCount);
    return {
      startIndex,
      endIndex,
      visibleRows: rows.slice(startIndex, endIndex),
      topSpacerHeight: startIndex * rowHeight,
      bottomSpacerHeight: Math.max(0, (rows.length - endIndex) * rowHeight),
    };
  }, [isVirtualized, maxBodyHeight, overscan, rowHeight, rows, scrollTop, visibleCount]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-800">
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading data...</p>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 px-6">
          <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">{emptyMessage}</p>
        </div>
      ) : (
        <div
          className="overflow-auto"
          style={{ maxHeight: maxBodyHeight }}
          onScroll={(event) => {
            if (isVirtualized) {
              setScrollTop(event.currentTarget.scrollTop);
            }
          }}
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800/95 text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="px-4 py-4 text-left font-medium uppercase tracking-wider w-12">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleAll}
                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    aria-label="Select all rows"
                  />
                </th>
                {columns.map((col, index) => (
                  <th
                    key={index}
                    className={`px-6 py-4 text-left font-medium uppercase tracking-wider ${col.toLowerCase() === 'actions' ? 'text-right' : ''}`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {windowedRows.topSpacerHeight > 0 && (
                <tr style={{ height: windowedRows.topSpacerHeight }}>
                  <td colSpan={columns.length + 1}></td>
                </tr>
              )}

              {windowedRows.visibleRows.map((row, visibleIndex) => {
                const rowIndex = windowedRows.startIndex + visibleIndex;
                const id = rowKey(row);
                const selected = selectedIds.has(id);

                return (
                  <tr
                    key={id}
                    style={{ height: rowHeight }}
                    className={`transition-colors duration-150 ${
                      selected
                        ? 'bg-red-50 dark:bg-red-900/20'
                        : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <td className="px-4 py-4 align-middle">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) =>
                          onToggleRow(id, rowIndex, (event.nativeEvent as MouseEvent).shiftKey)
                        }
                        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        aria-label={`Select row ${rowIndex + 1}`}
                      />
                    </td>
                    {renderRow(row)}
                  </tr>
                );
              })}

              {windowedRows.bottomSpacerHeight > 0 && (
                <tr style={{ height: windowedRows.bottomSpacerHeight }}>
                  <td colSpan={columns.length + 1}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BulkSelectableTable;
