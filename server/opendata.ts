const RESOURCE_BASE = "https://data.cityofnewyork.us/resource";

export function socrataHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = process.env.NYC_APP_TOKEN?.trim();
  if (token) headers["X-App-Token"] = token;
  return headers;
}

/** GET a Socrata (SODA) JSON resource. `params` are SoQL keys such as $select and $where. */
export async function socrataJson(
  datasetId: string,
  params: Record<string, string>,
  timeoutMs = 12_000,
): Promise<Record<string, unknown>[]> {
  const url = new URL(`${RESOURCE_BASE}/${datasetId}.json`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: socrataHeaders(),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`NYC Open Data ${datasetId} returned ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error(`NYC Open Data ${datasetId} returned an unexpected payload.`);
  }

  return payload.filter(
    (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object",
  );
}

/** Walk Socrata's 1,000-row pages until the dataset is exhausted or `maxRows` is hit. */
export async function socrataJsonPaged(
  datasetId: string,
  params: Record<string, string>,
  options: { pageSize?: number; maxRows?: number; timeoutMs?: number } = {},
): Promise<Record<string, unknown>[]> {
  const pageSize = options.pageSize ?? 1000;
  const maxRows = options.maxRows ?? 8000;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const collected: Record<string, unknown>[] = [];
  let offset = 0;

  while (collected.length < maxRows) {
    const take = Math.min(pageSize, maxRows - collected.length);
    const page = await socrataJson(
      datasetId,
      {
        ...params,
        $limit: String(take),
        $offset: String(offset),
      },
      timeoutMs,
    );
    collected.push(...page);
    if (page.length < take) break;
    offset += page.length;
  }

  return collected;
}
