"use client";

import { Search } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "../cn";
import { buttonClassName } from "./button";

export type CommandResult = {
  id: string;
  title: ReactNode;
  /** A line under the title: a date, an account. */
  meta?: ReactNode;
  /** At the right of the row: an amount. */
  aside?: ReactNode;
  onSelect: () => void;
};

/**
 * A search box over a list of results, opened with ⌘K: type, move with the
 * arrow keys, press Enter. Near the top of the screen on a wide one, a sheet
 * from the top on a phone. Built on Radix Dialog; focus stays in the input
 * while the arrow keys move through the list (the combobox pattern).
 */
export function CommandPalette({
  open,
  onOpenChange,
  placeholder,
  query,
  onQueryChange,
  results,
  empty,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder: string;
  query: string;
  onQueryChange: (query: string) => void;
  results: CommandResult[];
  /** Shown when there is a query and nothing matches. */
  empty: ReactNode;
  /** The dialog's name for screen readers: "Search transactions". */
  label: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;

  // The active row goes back to the first whenever the results change. That's
  // worked out while rendering (the results' IDs are the key), not in an effect.
  const key = results.map((result) => result.id).join("\n");
  const [picked, setPicked] = useState({ key, index: 0 });
  const active = picked.key === key ? Math.min(picked.index, results.length - 1) : 0;
  const move = (index: number) => setPicked({ key, index });

  const hasResults = results.length > 0;

  function select(result: CommandResult) {
    result.onSelect();
    onOpenChange(false);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (results[active]) select(results[active]);
      return;
    }
    if (results.length === 0 || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    event.preventDefault();
    const next = (active + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
    move(next);
    document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed inset-x-0 top-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-b-dialog border border-line-popover bg-card shadow-menu focus:outline-none sm:inset-x-auto sm:top-[12vh] sm:left-1/2 sm:w-[min(640px,calc(100vw-32px))] sm:-translate-x-1/2 sm:rounded-dialog">
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          <Dialog.Description className="sr-only">Type to search, use the arrow keys to move through the results and Enter to open one.</Dialog.Description>
          <div className={cn("flex items-center gap-3 px-4", (hasResults || query) && "border-b border-line-card")}>
            <Search size={18} aria-hidden="true" className="shrink-0 text-muted" />
            <input
              role="combobox"
              aria-expanded={hasResults}
              aria-controls={hasResults ? listId : undefined}
              aria-activedescendant={hasResults ? optionId(active) : undefined}
              aria-autocomplete="list"
              aria-label={label}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-faint focus:outline-none sm:text-field"
            />
          </div>
          {hasResults ? (
            <ul id={listId} role="listbox" aria-label={label} className="scrollbar-subtle max-h-[60dvh] overflow-y-auto p-2">
              {results.map((result, index) => (
                <li
                  key={result.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  // Keeps focus in the input when a row is pressed.
                  onMouseDown={(event) => event.preventDefault()}
                  onPointerMove={() => index !== active && move(index)}
                  onClick={() => select(result)}
                  className={cn("flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-control px-3 py-2", index === active && "bg-selected")}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-field font-medium">{result.title}</span>
                    {result.meta && <span className="truncate text-meta text-muted">{result.meta}</span>}
                  </span>
                  {result.aside && <span className="shrink-0 text-field tabular-nums">{result.aside}</span>}
                </li>
              ))}
            </ul>
          ) : (
            query && (
              <p role="status" className="px-4 py-6 text-center text-sm text-muted">
                {empty}
              </p>
            )
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const isApple = () => /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);

const isField = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Calls `onOpen` for ⌘K (Ctrl K off a Mac), and for "/" when focus isn't in a field, and stops the browser's own use of the keys. */
export function useCommandShortcut(onOpen: () => void) {
  // The latest callback, so a parent that doesn't memoise it doesn't re-listen every render.
  const latest = useRef(onOpen);
  useEffect(() => {
    latest.current = onOpen;
  });
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const mod = isApple() ? event.metaKey : event.ctrlKey;
      const chord = mod && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k";
      const slash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isField(event.target);
      if (!chord && !slash) return;
      event.preventDefault();
      latest.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

const subscribe = () => () => {};

/** What the shortcut is called on this device; "Ctrl K" on the server and until the page is hydrated. */
function useShortcutLabel() {
  return useSyncExternalStore(subscribe, () => (isApple() ? "⌘K" : "Ctrl K"), () => "Ctrl K");
}

/** A button that looks like a search field and opens the palette; on a phone, only the icon. */
export function SearchButton({ onClick, label }: { onClick: () => void; label: string }) {
  const shortcut = useShortcutLabel();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-keyshortcuts="Control+K Meta+K"
      className={buttonClassName("secondary", "md", "size-10 px-0 sm:size-auto sm:w-64 sm:justify-start sm:px-3")}
    >
      <Search size={16} aria-hidden="true" className="shrink-0 text-muted" />
      <span className="hidden min-w-0 flex-1 truncate text-left font-normal text-muted sm:block">{label}</span>
      <kbd className="ml-auto hidden rounded-[6px] border border-line-field px-1.5 font-sans text-[11px] leading-5 font-medium text-muted sm:block">{shortcut}</kbd>
    </button>
  );
}
