// micasa's messages, said plainly. Kept apart from the Server Action helper
// so they can be tested without a server.

/** "serviced_at: invalid date value" → "Serviced at: invalid date value." */
function sentence(message: string): string {
  const text = message.replace(/^([a-z_]+):/, (_, field: string) => `${field.replace(/_/g, " ")}:`);
  const capital = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(capital) ? capital : `${capital}.`;
}

/**
 * micasa refuses to delete what other records still use:
 * "project has 2 active quote(s) -- delete them first" →
 * "This project still has 2 quotes. Delete them first."
 */
function dependency(message: string): string | null {
  const match = /^(.+?) has (\d+) active (.+?)\(s\) -- (.+)$/.exec(message);
  if (!match) return null;
  const [, thing, count, noun, rest] = match as unknown as [string, string, string, string, string];
  const n = Number(count);
  return `This ${thing} still has ${n === 1 ? `1 ${noun}` : `${n} ${noun}s`}. ${rest.charAt(0).toUpperCase()}${rest.slice(1)}.`;
}

/** What to show for one of micasa's error messages. */
export const plainMessage = (message: string) => dependency(message) ?? sentence(message);
