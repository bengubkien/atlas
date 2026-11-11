"use client";

import { useState, type ReactNode } from "react";

/**
 * A long list that draws only the rows in view (band 7–9 has 5,600 words).
 * Rows are one fixed height, so the scroll position says which ones. It
 * scrolls inside its own box; key it by what it lists so a new list starts
 * at the top.
 */
export function WordWindow<T>({
  items,
  rowHeight,
  label,
  itemKey,
  children,
  className = "",
}: {
  items: readonly T[];
  rowHeight: number;
  /** Names the list for screen readers. */
  label: string;
  itemKey: (item: T) => string;
  children: (item: T, index: number) => ReactNode;
  className?: string;
}) {
  const [top, setTop] = useState(0);
  // More than a tall phone shows, so a quick flick never reveals a gap.
  const VISIBLE = 24;
  const OVERSCAN = 6;
  const first = Math.max(0, Math.floor(top / rowHeight) - OVERSCAN);
  const last = Math.min(items.length, first + VISIBLE + OVERSCAN * 2);

  return (
    // The box can be scrolled with the keyboard once it's focused.
    <div
      tabIndex={0}
      role="region"
      aria-label={label}
      onScroll={(event) => setTop(event.currentTarget.scrollTop)}
      className={`overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${className}`}
    >
      <ul role="list" className="relative" style={{ height: items.length * rowHeight }}>
        {items.slice(first, last).map((item, i) => (
          <li
            key={itemKey(item)}
            aria-setsize={items.length}
            aria-posinset={first + i + 1}
            className="absolute inset-x-0 flex items-stretch border-b border-line"
            style={{ top: (first + i) * rowHeight, height: rowHeight }}
          >
            {children(item, first + i)}
          </li>
        ))}
      </ul>
    </div>
  );
}
