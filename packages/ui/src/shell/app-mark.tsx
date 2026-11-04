import { APPS, type AppId } from "../apps";
import { cn } from "../cn";

/**
 * An app's mark: its line icon in white on its colour, in a rounded square
 * like Dossier's. Decorative: put the app's name next to it.
 */
export function AppMark({ app, size = 32, className }: { app: AppId; size?: number; className?: string }) {
  const { icon: Icon, accent } = APPS[app];
  return (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center text-white", className)}
      style={{ width: size, height: size, borderRadius: size * 0.22, backgroundColor: accent }}
    >
      <Icon size={Math.round(size * 0.56)} strokeWidth={size >= 40 ? 1.75 : 2} />
    </span>
  );
}
