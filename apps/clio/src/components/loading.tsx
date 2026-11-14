/** While this device's copy is opening: a few milliseconds, so nothing more than a quiet line. */
export function Loading() {
  return (
    <p role="status" className="px-4 py-10 text-sm text-muted lg:px-10">
      Opening…
    </p>
  );
}
