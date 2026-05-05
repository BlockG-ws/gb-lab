#!/usr/bin/env tsx
import * as crypto from 'node:crypto';
import * as fs from 'fs';
import * as path from 'path';

// Helper to generate key pair
async function generateKeyPair() {
  return await crypto.webcrypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  );
}

async function exportPem(key: CryptoKey, type: "public" | "private"): Promise<string> {
  const exported = await crypto.webcrypto.subtle.exportKey(type === "public" ? "spki" : "pkcs8", key);
  const exportedAsString = Buffer.from(exported).toString("base64");
  let pem = `-----BEGIN ${type === "public" ? "PUBLIC" : "PRIVATE"} KEY-----\n`;
  for (let i = 0; i < exportedAsString.length; i += 64) {
    pem += exportedAsString.substring(i, i + 64) + "\n";
  }
  pem += `-----END ${type === "public" ? "PUBLIC" : "PRIVATE"} KEY-----\n`;
  return pem;
}

function escapeForEnv(pem: string) {
  // Convert multiline PEM to single-line with literal \n escapes
  return pem.replace(/\r?\n/g, '\\n');
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write') || args.includes('-w');
  const outFile = path.resolve(process.cwd(), '.env');

  const keys = await generateKeyPair();
  const publicKey = await exportPem(keys.publicKey, "public");
  const privateKey = await exportPem(keys.privateKey, "private");

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

