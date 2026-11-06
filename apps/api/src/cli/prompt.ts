import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

/** Asks a question on the terminal. With `hidden`, typed characters are not echoed. */
export async function ask(question: string, hidden = false): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error(
      'This command is interactive: run it in a terminal (secrets are never read from arguments or files).',
    );
  }
  let muted = false;
  const output = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  try {
    const answer = rl.question(question);
    muted = hidden;
    const value = await answer;
    if (hidden) process.stdout.write('\n');
    return value;
  } finally {
    rl.close();
  }
}
