const encoder = new TextEncoder();

function bufferSource(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function encoded(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decoded(value: string): Uint8Array {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function issueSession(secret: string): Promise<{ userId: string; token: string }> {
  const userId = crypto.randomUUID();
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await signingKey(secret), bufferSource(encoder.encode(userId))));
  return { userId, token: `${userId}.${encoded(signature)}` };
}

export async function verifySession(secret: string, token: string): Promise<string | null> {
  const [userId, signature, extra] = token.split('.');
  if (extra !== undefined || !userId || !signature || !/^[0-9a-f-]{36}$/.test(userId)) return null;
  try {
    return await crypto.subtle.verify('HMAC', await signingKey(secret), bufferSource(decoded(signature)), bufferSource(encoder.encode(userId)))
      ? userId : null;
  } catch {
    return null;
  }
}

export async function hashIp(ip: string): Promise<string> {
  const bytes = encoder.encode(ip);
  return encoded(new Uint8Array(await crypto.subtle.digest('SHA-256', bufferSource(bytes))));
}
