import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useBulkSelection } from '../useBulkSelection';

interface RowFixture {
  id: string;
  label: string;
}

const rows: RowFixture[] = [
  { id: 'u1', label: 'One' },
  { id: 'u2', label: 'Two' },
  { id: 'u3', label: 'Three' },
  { id: 'u4', label: 'Four' },
  { id: 'u5', label: 'Five' },
];

const toSorted = (value: Set<string>): string[] => [...value].sort();

describe('useBulkSelection', () => {
  it('supports single select toggle', () => {
    const { result } = renderHook(() => useBulkSelection(rows, (row) => row.id));

    act(() => {
      result.current.toggleSelect('u2', { index: 1 });
    });

    expect(result.current.selectedCount).toBe(1);
    expect(result.current.isSelected('u2')).toBe(true);
    expect(result.current.someSelected).toBe(true);
    expect(result.current.allSelected).toBe(false);

    act(() => {
      result.current.toggleSelect('u2', { index: 1 });
    });

    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isSelected('u2')).toBe(false);
  });

  it('supports select-all and clear-all', () => {
    const { result } = renderHook(() => useBulkSelection(rows, (row) => row.id));

    act(() => {
      result.current.selectAll();
    });

    expect(result.current.selectedCount).toBe(rows.length);
    expect(result.current.allSelected).toBe(true);
    expect(result.current.someSelected).toBe(false);

    act(() => {
      result.current.selectAll();
    });

    expect(result.current.selectedCount).toBe(0);
    expect(result.current.allSelected).toBe(false);
  });

  it('supports shift range selection', () => {
    const { result } = renderHook(() => useBulkSelection(rows, (row) => row.id));

    act(() => {
      result.current.toggleSelect('u2', { index: 1 });
    });

    act(() => {
      result.current.toggleSelect('u5', { index: 4, shiftKey: true });
    });

    expect(toSorted(result.current.selectedIds)).toEqual(['u2', 'u3', 'u4', 'u5']);
  });

  it('clears selection explicitly', () => {
    const { result } = renderHook(() => useBulkSelection(rows, (row) => row.id));

    act(() => {
      result.current.toggleSelect('u1', { index: 0 });
      result.current.toggleSelect('u3', { index: 2 });
    });

    expect(result.current.selectedCount).toBe(2);

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedCount).toBe(0);
    expect(result.current.selectedIdsArray).toEqual([]);
  });

  it('removes stale selections when rows change', () => {
    const { result, rerender } = renderHook(
      ({ items }) => useBulkSelection(items, (row) => row.id),
      { initialProps: { items: rows } },
    );

    act(() => {
      result.current.toggleSelect('u1', { index: 0 });
      result.current.toggleSelect('u5', { index: 4 });
    });

    rerender({ items: rows.slice(0, 3) });

    expect(result.current.selectedIdsArray).toEqual(['u1']);
    expect(result.current.selectedCount).toBe(1);
  });
});
