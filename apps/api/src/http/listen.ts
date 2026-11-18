import { readFileSync } from 'node:fs';
import { createServer as createHttpServer, type RequestListener, type Server } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';

export type TlsFiles = Readonly<{ certFile: string; keyFile: string }>;

/**
 * The main listener: HTTPS when certificate files are configured, plain HTTP otherwise
 * (configuration refuses plain HTTP on a network address in production). TLS 1.2 is the floor.
 * Certificate errors stop start-up with a message that names the setting, never the file content.
 */
export function createListener(handler: RequestListener, tls?: TlsFiles): Server {
  if (tls === undefined) return createHttpServer(handler);
  let cert: Buffer;
  let key: Buffer;
  try {
    cert = readFileSync(tls.certFile);
  } catch {
    throw new Error('TLS_CERT_FILE: the file could not be read');
  }
  try {
    key = readFileSync(tls.keyFile);
  } catch {
    throw new Error('TLS_KEY_FILE: the file could not be read');
  }
  try {
    return createHttpsServer({ cert, key, minVersion: 'TLSv1.2' }, handler);
  } catch {
    throw new Error('TLS_CERT_FILE / TLS_KEY_FILE: not a valid PEM certificate and key pair');
  }
}
