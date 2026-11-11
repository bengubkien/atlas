import { serviceWorkerRouteFor } from "@atlas/sync/service-worker";

/**
 * The offline copy's worker (see @atlas/sync/service-worker). The HSK list is
 * small and every screen wants it, so it's kept at install; the dictionary
 * (9 MB) is kept the first time something asks for it.
 */
export const GET = serviceWorkerRouteFor({ precache: ["/data/hsk.json"] });
