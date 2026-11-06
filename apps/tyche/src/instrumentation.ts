// Next.js calls register() once when a server starts. It doesn't run during
// `next build`.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // The day's dollar quotes, every few hours (lib/server/rates.ts).
    const { startRates } = await import("@/lib/server/rates");
    startRates();
  }
}
