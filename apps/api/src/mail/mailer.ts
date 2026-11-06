import { createConnection } from 'node:net';

/**
 * Outgoing email. Development uses the local Mailpit catcher (SMTP on 127.0.0.1:1026); tests use
 * the capture mailer. No real provider is configured in Release 1 (a paid provider needs separate
 * approval). Message bodies are never logged.
 */
export type MailMessage = Readonly<{ to: string; subject: string; text: string }>;

export type Mailer = Readonly<{ send: (message: MailMessage) => Promise<void> }>;

export function captureMailer(): Mailer & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    sent,
    send(message) {
      sent.push(message);
      return Promise.resolve();
    },
  };
}

/** Header values may not carry line breaks (header injection). */
function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

/**
 * A minimal SMTP client for an unauthenticated local catcher. It refuses any host other than
 * loopback, so it can never send real email by mistake.
 */
export function localSmtpMailer(
  options: Readonly<{ host: string; port: number; from: string }>,
): Mailer {
  if (!['127.0.0.1', 'localhost', '::1'].includes(options.host)) {
    throw new Error('the local SMTP mailer only talks to a catcher on this machine');
  }
  return {
    send(message) {
      return new Promise((resolve, reject) => {
        const socket = createConnection({ host: options.host, port: options.port });
        socket.setTimeout(5_000, () => socket.destroy(new Error('SMTP timeout')));
        const body = message.text.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
        const script = [
          'EHLO hospitalos-api',
          `MAIL FROM:<${headerSafe(options.from)}>`,
          `RCPT TO:<${headerSafe(message.to)}>`,
          'DATA',
          [
            `From: HospitalOS <${headerSafe(options.from)}>`,
            `To: <${headerSafe(message.to)}>`,
            `Subject: ${headerSafe(message.subject)}`,
            'Content-Type: text/plain; charset=utf-8',
            '',
            body,
            '.',
          ].join('\r\n'),
          'QUIT',
        ];
        let step = 0;
        let buffer = '';
        socket.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
          // Wait for the final line of a (possibly multi-line) reply: "250 ok", not "250-...".
          const lines = buffer.split('\r\n').filter(Boolean);
          const last = lines.at(-1) ?? '';
          if (!/^\d{3} /.test(last)) return;
          buffer = '';
          if (!/^[23]/.test(last)) {
            socket.destroy(new Error(`SMTP refused (${last.slice(0, 3)})`));
            return;
          }
          const next = script[step];
          step += 1;
          if (next === undefined) socket.end();
          else socket.write(`${next}\r\n`);
        });
        socket.on('error', reject);
        socket.on('close', (hadError) => {
          if (!hadError && step >= script.length) resolve();
          else if (!hadError) reject(new Error('SMTP connection closed early'));
        });
      });
    },
  };
}
