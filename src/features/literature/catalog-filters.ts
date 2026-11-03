export type CatalogFilters = { query: string; author: string; genre: string };

type SearchParameters = Record<string, string | string[] | undefined>;

/** Repeated or oversized query parameters never reach the database unchecked. */
export function readCatalogFilters(parameters: SearchParameters): CatalogFilters {
  function value(name: string, maximum: number) {
    const input = parameters[name];
    return typeof input === "string" ? input.trim().normalize("NFC").slice(0, maximum) : "";
  }
  return { query: value("q", 200), author: value("author", 200), genre: value("genre", 200) };
}
