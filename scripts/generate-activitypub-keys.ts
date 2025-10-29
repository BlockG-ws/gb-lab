#!/usr/bin/env tsx
import { generateKeyPair as gen } from '@/plugins/activitypub/crypto';
import * as fs from 'fs';
import * as path from 'path';

function escapeForEnv(pem: string) {
  // Convert multiline PEM to single-line with literal \n escapes
  return pem.replace(/\r?\n/g, '\\n');
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write') || args.includes('-w');
  const outFile = path.resolve(process.cwd(), '.env');

  const { publicKey, privateKey } = gen();

  const publicEsc = escapeForEnv(publicKey);
  const privateEsc = escapeForEnv(privateKey);

  const publicLine = `ACTIVITYPUB_PUBLIC_KEY="${publicEsc}"`;
  const privateLine = `ACTIVITYPUB_PRIVATE_KEY="${privateEsc}"`;

  console.log('# Add these to your .env (or run with --write to append to .env)');
  console.log(publicLine);
  console.log(privateLine);

  if (write) {
    let existing = '';
    try {
      existing = fs.readFileSync(outFile, 'utf8');
    } catch (err) {
      // ignore if file doesn't exist
    }

    const linesToAppend: string[] = [];
    if (!/ACTIVITYPUB_PUBLIC_KEY\s*=/.test(existing)) linesToAppend.push(publicLine);
    if (!/ACTIVITYPUB_PRIVATE_KEY\s*=/.test(existing)) linesToAppend.push(privateLine);

    if (linesToAppend.length === 0) {
      console.log('.env already contains ACTIVITYPUB_PUBLIC_KEY and ACTIVITYPUB_PRIVATE_KEY — nothing to do.');
      return;
    }

    const toWrite = '\n' + linesToAppend.join('\n') + '\n';
    fs.appendFileSync(outFile, toWrite, 'utf8');
    console.log(`Appended ${linesToAppend.length} lines to ${outFile}`);
  }
}

main().catch(err => {
  console.error('Error generating keys:', err);
  process.exit(1);
});

