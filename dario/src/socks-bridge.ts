/**
 * Per-account SOCKS5 egress — local HTTP-CONNECT → SOCKS5 bridge.
 *
 * Bun's fetch `proxy` option only speaks http/https (socks5:// yields
 * `UnsupportedProxyProtocol` on Bun 1.3.x). To route a single account's
 * upstream traffic through a SOCKS5 proxy WITHOUT touching dario's
 * validated Bun-fetch path (the TLS ClientHello + header order stay byte-
 * identical), we stand up a tiny loopback HTTP proxy per distinct proxy
 * URL: Bun fetch is pointed at `http://127.0.0.1:<port>`, it sends a
 * CONNECT for the upstream host, and the bridge tunnels that CONNECT
 * through the SOCKS5 proxy.
 *
 * TLS still terminates at api.anthropic.com — the bridge only relays the
 * already-encrypted bytes, so Bun's BoringSSL fingerprint is preserved
 * end-to-end (same property outbound-proxy.ts notes for HTTP proxies).
 *
 * Zero-dependency: the SOCKS5 client handshake (RFC 1928 CONNECT, with
 * optional RFC 1929 username/password auth) is hand-rolled over node:net
 * rather than pulling in the `socks` package, keeping dario's
 * zero-runtime-dependency stance.
 *
 * Requires Bun: the per-call `proxy` fetch option is a Bun extension. On
 * Node the option is silently ignored — proxy.ts warns at startup if any
 * account is configured with a proxy on a non-Bun runtime.
 */
import net from 'node:net';

export type ProxyKind = 'none' | 'http' | 'https' | 'socks';

/**
 * Classify a proxy URL string. Unparseable / empty / unknown schemes →
 * 'none' (no proxy applied). socks4/socks4a parse as 'socks' but only
 * socks5/socks5h are actually tunneled — see connectSocks5.
 */
export function classifyProxy(raw: string | undefined | null): ProxyKind {
  if (!raw || !raw.trim()) return 'none';
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return 'none';
  }
  const s = u.protocol.replace(/:$/, '').toLowerCase();
  if (s === 'http') return 'http';
  if (s === 'https') return 'https';
  if (s === 'socks5' || s === 'socks5h' || s === 'socks') return 'socks';
  return 'none';
}

export function isBunRuntime(): boolean {
  return typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined';
}

/**
 * Resolve an account's proxy URL into a value Bun fetch's `proxy` option
 * understands. http/https pass through unchanged; socks* are bridged to a
 * loopback HTTP proxy. Empty / unknown → undefined (no proxy).
 */
export async function resolveAccountProxy(
  raw: string | undefined | null,
): Promise<string | undefined> {
  const kind = classifyProxy(raw);
  if (kind === 'none') return undefined;
  if (kind === 'http' || kind === 'https') return raw!.trim();
  return ensureSocksBridge(raw!.trim());
}

// One bridge per distinct SOCKS5 URL, lazily created and reused for the
// lifetime of the proxy process.
const bridges = new Map<string, Promise<string>>();

export function ensureSocksBridge(socksUrl: string): Promise<string> {
  const existing = bridges.get(socksUrl);
  if (existing) return existing;
  const started = startBridge(socksUrl).catch((err) => {
    // Don't cache a failed bridge — let a later request retry.
    bridges.delete(socksUrl);
    throw err;
  });
  bridges.set(socksUrl, started);
  return started;
}

function startBridge(socksUrl: string): Promise<string> {
  const proxy = new URL(socksUrl);
  const server = net.createServer((client) => {
    client.on('error', () => client.destroy());
    let buf: Buffer = Buffer.alloc(0);
    const onData = (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      const idx = buf.indexOf('\r\n\r\n');
      if (idx === -1) {
        if (buf.length > 16384) client.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        return;
      }
      client.removeListener('data', onData);
      const headLine = buf.slice(0, idx).toString('latin1').split('\r\n')[0] ?? '';
      const m = /^CONNECT\s+([^:\s]+):(\d+)/i.exec(headLine);
      if (!m) {
        client.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        return;
      }
      const destHost = m[1]!;
      const destPort = Number(m[2]);
      const leftover = buf.slice(idx + 4);
      connectSocks5(proxy, destHost, destPort)
        .then((upstream) => {
          client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          if (leftover.length) upstream.write(leftover);
          client.pipe(upstream);
          upstream.pipe(client);
          const close = () => {
            upstream.destroy();
            client.destroy();
          };
          upstream.on('error', close);
          client.on('error', close);
          upstream.on('close', () => client.destroy());
          client.on('close', () => upstream.destroy());
        })
        .catch(() => {
          if (!client.destroyed) client.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        });
    };
    client.on('data', onData);
  });
  return new Promise<string>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      // The bridge lives for the whole proxy run; unref so it never keeps
      // the event loop alive on its own.
      server.unref();
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

/**
 * Open a TCP connection to destHost:destPort THROUGH a SOCKS5 proxy.
 * Implements the RFC 1928 CONNECT handshake with optional RFC 1929
 * username/password auth. The destination is always sent as a domain name
 * (ATYP=0x03) so DNS resolves at the proxy (socks5h semantics — no local
 * DNS leak). Resolves with the live tunnel socket.
 */
function connectSocks5(proxy: URL, destHost: string, destPort: number): Promise<net.Socket> {
  const proxyHost = proxy.hostname;
  const proxyPort = Number(proxy.port) || 1080;
  const user = proxy.username ? decodeURIComponent(proxy.username) : '';
  const pass = proxy.password ? decodeURIComponent(proxy.password) : '';
  const wantAuth = user.length > 0 || pass.length > 0;

  return new Promise<net.Socket>((resolve, reject) => {
    const socket = net.connect(proxyPort, proxyHost);
    let stage: 'greeting' | 'auth' | 'request' = 'greeting';
    let acc: Buffer = Buffer.alloc(0);
    let settled = false;

    const fail = (msg: string) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error(`SOCKS5 ${proxyHost}:${proxyPort}: ${msg}`));
    };

    socket.setTimeout(15000, () => fail('handshake timeout'));
    socket.on('error', (e) => {
      if (settled) return;
      settled = true;
      reject(e);
    });

    socket.on('connect', () => {
      const methods = wantAuth ? [0x00, 0x02] : [0x00];
      socket.write(Buffer.from([0x05, methods.length, ...methods]));
    });

    const sendRequest = () => {
      stage = 'request';
      const hostBuf = Buffer.from(destHost, 'utf8');
      socket.write(
        Buffer.concat([
          Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuf.length]),
          hostBuf,
          Buffer.from([(destPort >> 8) & 0xff, destPort & 0xff]),
        ]),
      );
    };

    socket.on('data', (chunk: Buffer) => {
      acc = Buffer.concat([acc, chunk]);

      if (stage === 'greeting') {
        if (acc.length < 2) return;
        if (acc[0] !== 0x05) return fail('bad version in method reply');
        const method = acc[1];
        acc = acc.slice(2);
        if (method === 0x00) {
          sendRequest();
        } else if (method === 0x02) {
          if (!wantAuth) return fail('proxy demands auth but no credentials given');
          stage = 'auth';
          const u = Buffer.from(user, 'utf8');
          const p = Buffer.from(pass, 'utf8');
          socket.write(
            Buffer.concat([Buffer.from([0x01, u.length]), u, Buffer.from([p.length]), p]),
          );
        } else {
          return fail(`no acceptable auth method (0x${(method ?? 0).toString(16)})`);
        }
        return;
      }

      if (stage === 'auth') {
        if (acc.length < 2) return;
        const status = acc[1];
        acc = acc.slice(2);
        if (status !== 0x00) return fail('username/password auth rejected');
        sendRequest();
        return;
      }

      // stage === 'request': reply VER REP RSV ATYP BND.ADDR BND.PORT
      if (acc.length < 4) return;
      if (acc[0] !== 0x05) return fail('bad version in connect reply');
      const rep = acc[1]!;
      if (rep !== 0x00) return fail(`connect failed (REP=0x${rep.toString(16)})`);
      const atyp = acc[3];
      let need = 4 + 2;
      if (atyp === 0x01) need += 4;
      else if (atyp === 0x04) need += 16;
      else if (atyp === 0x03) {
        if (acc.length < 5) return;
        need += 1 + acc[4]!;
      } else return fail(`unknown ATYP 0x${(atyp ?? 0).toString(16)}`);
      if (acc.length < need) return;

      // Tunnel established. Detach handshake listeners, clear the timeout,
      // and hand the socket to the bridge. Any bytes beyond the reply are
      // unexpected for a fresh CONNECT but are pushed back so piping sees them.
      settled = true;
      const extra = acc.slice(need);
      socket.removeAllListeners('data');
      socket.removeAllListeners('timeout');
      socket.setTimeout(0);
      if (extra.length) socket.unshift(extra);
      resolve(socket);
    });
  });
}
