import crypto from 'crypto';

type VaultKeyBytes = Buffer;

function decodeKey(input: string): Buffer {
  const trimmed = input.trim();

  // hex-encoded 32 bytes
  if (/^[a-f0-9]{64}$/i.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  // base64-encoded 32 bytes
  try {
    const buf = Buffer.from(trimmed, 'base64');
    if (buf.length === 32) return buf;
  } catch {
    // ignore
  }

  // last resort: treat as utf8 (must still be 32 bytes)
  return Buffer.from(trimmed, 'utf8');
}

export function loadVaultKeyFromEnv(envValue: string | undefined): VaultKeyBytes {
  if (!envValue) {
    throw new Error('PRIME_CREDENTIALS_ENCRYPTION_KEY is required when PRIME_STAKING_ENABLED=1');
  }

  const key = decodeKey(envValue);
  if (key.length !== 32) {
    throw new Error('PRIME_CREDENTIALS_ENCRYPTION_KEY must decode to 32 bytes (hex64 or base64)');
  }

  return key;
}

export function encryptString(plaintext: string, key: VaultKeyBytes): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptString(envelope: string, key: VaultKeyBytes): string {
  const parts = envelope.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Invalid vault envelope format');
  }

  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const ciphertext = Buffer.from(parts[3], 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

