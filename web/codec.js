// Group messages: compressed JSON, encrypted with AES-GCM under the group key.
// The key only exists in the group link, so the public relay never sees readable data.
// Shared by the companion (Node) and the page (browser): both have WebCrypto and CompressionStream.

const text = new TextEncoder();
const untext = new TextDecoder();

export function fromB64url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function toB64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function through(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

export function importKey(b64) {
  return crypto.subtle.importKey('raw', fromB64url(b64), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encode(value, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const packed = await through(text.encode(JSON.stringify(value)), new CompressionStream('deflate-raw'));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, packed));
  const out = new Uint8Array(iv.length + sealed.length);
  out.set(iv);
  out.set(sealed, iv.length);
  return out;
}

export async function decode(bytes, key) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  return JSON.parse(untext.decode(await through(new Uint8Array(plain), new DecompressionStream('deflate-raw'))));
}
