/** What a Server Action answers, as in Dossier: its data, or an error to show. */
export type ActionResult<T> =
  | { ok: true; data: T; toast?: string }
  | {
      ok: false;
      error: string;
      /** Messages per input field when validation failed. */
      fieldErrors?: Partial<Record<string, string[]>>;
    };
