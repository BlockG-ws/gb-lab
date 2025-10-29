import { createHash, createSign, createVerify, generateKeyPairSync } from 'crypto';

// Normalize PEM strings that may contain escaped newline sequences (common double-escaped cases).
// Converts literal "\\n" sequences into real newlines, trims surrounding quotes, and
// ensures we return a usable PEM string.
export function normalizePem(pem: string | undefined): string | undefined {
  if (!pem) return undefined;
  // Don't trim here to preserve original newline structure; work on the raw string
  let out = String(pem);

  // Remove surrounding quotes if present (after trimming outer whitespace)
  const trimmed = out.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    out = trimmed.slice(1, -1);
  }

  // Iteratively unescape double-escaped and single-escaped newline sequences.
  // First convert "\\\\n" -> "\\n", then "\\n" -> "\n".
  for (let i = 0; i < 5; i++) {
    if (/\\\\r\\n/.test(out) || /\\\\n/.test(out)) {
      out = out.replace(/\\\\r\\n/g, '\\r\\n').replace(/\\\\n/g, '\\n');
      continue;
    }
    if (/\\r\\n/.test(out) || /\\n/.test(out)) {
      out = out.replace(/\\r\\n/g, '\r\n').replace(/\\n/g, '\n');
      continue;
    }
    break;
  }

  // If we don't seem to have a PEM header after normalization, fall back to the original input
  if (!/-----BEGIN [A-Z ]+-----/.test(out)) {
    return pem;
  }

  return out;
}

// Generate RSA key pair for ActivityPub
export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return { publicKey, privateKey };
}

// Create HTTP signature for ActivityPub requests
export function createHttpSignature(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string,
  privateKey: string,
  keyId: string
): string {
  const date = new Date().toUTCString();
  const digest = createHash('sha256').update(body).digest('base64');
  
  headers['date'] = date;
  headers['digest'] = `SHA-256=${digest}`;
  
  const signatureString = [
    `(request-target): ${method.toLowerCase()} ${new URL(url).pathname}`,
    `host: ${new URL(url).host}`,
    `date: ${date}`,
    `digest: SHA-256=${digest}`,
  ].join('\n');
  
  const signature = createSign('sha256')
    .update(signatureString)
    .sign(privateKey, 'base64');
  
  return `keyId="${keyId}",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="${signature}"`;
}

// Verify HTTP signature
export function verifyHttpSignature(
  signature: string,
  method: string,
  path: string,
  headers: Record<string, string>,
  publicKey: string
): boolean {
  try {
    const sigParams = parseSignatureHeader(signature);
    if (!sigParams.keyId || !sigParams.signature || !sigParams.headers) {
      return false;
    }
    
    const headerList = sigParams.headers.split(' ');
    const signatureString = headerList
      .map(header => {
        if (header === '(request-target)') {
          return `(request-target): ${method.toLowerCase()} ${path}`;
        }
        // use lower-case header key access
        const value = headers[header.toLowerCase()];
        return `${header}: ${value}`;
      })
      .join('\n');
    
    const verify = createVerify('sha256');
    verify.update(signatureString);
    return verify.verify(publicKey, sigParams.signature, 'base64');
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Parse signature header
export function parseSignatureHeader(signature: string): Record<string, string> {
  const params: Record<string, string> = {};
  const regex = /(\w+)="([^"]+)"/g;
  let match;
  
  while ((match = regex.exec(signature)) !== null) {
    params[match[1]] = match[2];
  }
  
  return params;
}

// Create digest header
export function createDigest(body: string): string {
  const hash = createHash('sha256').update(body).digest('base64');
  return `SHA-256=${hash}`;
}

// Verify digest header
export function verifyDigest(body: string, digest: string): boolean {
  const expectedDigest = createDigest(body);
  return digest === expectedDigest;
}

// Verify an incoming ActivityPub HTTP request's digest and HTTP Signature.
// Steps:
// - Verify Digest header matches the body.
// - Parse the Signature header and fetch the key owner (keyId without fragment) to get the public key PEM.
// - Use verifyHttpSignature to validate signature over the expected headers.
export async function verifyIncomingRequest(
  method: string,
  url: string,
  headersMap: Record<string, string | null>,
  body: string
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const signatureHeader = headersMap['signature'] || headersMap['Signature'] || headersMap['Signature'.toLowerCase()];
    const digestHeader = headersMap['digest'] || headersMap['Digest'] || headersMap['digest'.toLowerCase()];

    // If there is no signature header, fail verification
    if (!signatureHeader) {
      return { ok: false, reason: 'Missing Signature header' };
    }

    // Verify digest if present
    if (digestHeader) {
      if (!verifyDigest(body, digestHeader)) {
        return { ok: false, reason: 'Digest mismatch' };
      }
    }

    const sigParams = parseSignatureHeader(signatureHeader);
    if (!sigParams.keyId) return { ok: false, reason: 'No keyId in signature' };

    // Resolve keyId to a resource to fetch public key. keyId often contains a fragment (#main-key)
    const keyId = sigParams.keyId;
    const keyUrl = keyId.split('#')[0];

    // Fetch the key owner (actor) or the key URL directly
    const res = await fetch(keyUrl, { headers: { Accept: 'application/activity+json' } });
    if (!res.ok) {
      return { ok: false, reason: `Failed to fetch key owner: ${res.status}` };
    }

    const actor = await res.json().catch(() => null);
    if (!actor) return { ok: false, reason: 'Unable to parse actor/key resource JSON' };

    // Public key may be at actor.publicKey.publicKeyPem or the resource itself (if it's the key URL)
    let publicKeyPem: string | undefined;

    if (actor.publicKey) {
      // actor.publicKey can be an object or array
      if (typeof actor.publicKey === 'string') {
        publicKeyPem = actor.publicKey;
      } else if (Array.isArray(actor.publicKey)) {
        publicKeyPem = actor.publicKey[0]?.publicKeyPem || actor.publicKey[0]?.publicKey || undefined;
      } else if (typeof actor.publicKey === 'object') {
        publicKeyPem = actor.publicKey.publicKeyPem || actor.publicKey.publicKey;
      }
    }

    // If the fetched resource is the key itself (contains publicKeyPem or publicKeyPem directly)
    if (!publicKeyPem && actor.publicKeyPem) {
      publicKeyPem = actor.publicKeyPem;
    }

    if (!publicKeyPem) {
      return { ok: false, reason: 'No public key found on key resource' };
    }

    // Normalize publicKeyPem to ensure escaped newlines are converted to real newlines
    publicKeyPem = normalizePem(publicKeyPem) || '';

    // Build a headers object expected by verifyHttpSignature: lower-case keys
    const headersObj: Record<string, string> = {};
    if (headersMap['host']) headersObj['host'] = headersMap['host'] as string;
    else headersObj['host'] = new URL(url).host;

    const dateHeader = headersMap['date'] || headersMap['Date'] || headersMap['date'.toLowerCase()];
    if (dateHeader) headersObj['date'] = dateHeader as string;

    const digestH = digestHeader;
    if (digestH) headersObj['digest'] = digestH as string;

    // Enforce Date freshness (prevent replay) if Date header is present
    if (dateHeader) {
      const parsed = Date.parse(String(dateHeader));
      if (isNaN(parsed)) return { ok: false, reason: 'Invalid Date header' };
      const now = Date.now();
      const skew = Math.abs(now - parsed);
      const maxSkewMs = 5 * 60 * 1000; // 5 minutes
      if (skew > maxSkewMs) {
        return { ok: false, reason: 'Date header outside allowed window' };
      }
    }

    // Path part
    const path = new URL(url).pathname;

    const ok = verifyHttpSignature(signatureHeader, method, path, headersObj, publicKeyPem);
    if (!ok) return { ok: false, reason: 'Signature verification failed' };

    return { ok: true };
  } catch (error) {
    console.error('verifyIncomingRequest error:', error);
    return { ok: false, reason: 'Exception during verification' };
  }
}
