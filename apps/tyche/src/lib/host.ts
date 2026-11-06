"use client";

import { useSyncExternalStore } from "react";

const never = () => () => {};

/** This server's address as the browser sees it ("hygeia.tail1234.ts.net"); empty while the server renders. */
export const useHost = () => useSyncExternalStore(never, () => window.location.host, () => "");
