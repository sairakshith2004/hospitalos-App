/**
 * Request-log serializer. Query strings carry patient search terms (names, phone numbers, MRNs:
 * `GET /patients?q=…`), so request logs keep the path only and never the query string or the
 * parsed query (architecture §3 rule 8). Headers stay subject to the logger's redaction paths.
 */
type SerializedRequest = {
  id?: unknown;
  method?: unknown;
  url?: unknown;
  headers?: unknown;
  remoteAddress?: unknown;
  remotePort?: unknown;
};

export function withoutQuery(req: SerializedRequest): SerializedRequest {
  const url = typeof req.url === 'string' ? req.url.split('?')[0] : req.url;
  return {
    id: req.id,
    method: req.method,
    url,
    headers: req.headers,
    remoteAddress: req.remoteAddress,
    remotePort: req.remotePort,
  };
}
