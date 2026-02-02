/**
 * Secure Credential Storage for clawhub CLI
 * 
 * Uses OS-native secure credential storage:
 * - macOS: Keychain
 * - Windows: Credential Vault
 * - Linux: libsecret (GNOME Keyring / KWallet)
 * 
 * Falls back to encrypted file storage if keytar is unavailable.
 * 
 * SECURITY FIX: Addresses Moltbot plaintext token vulnerability
 * (CVE reference: Hudson Rock infostealer targeting, GitGuardian leak disclosure)
 */

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { homedir, hostname, userInfo } from 'node:os'
import { dirname, join } from 'node:path'

const SERVICE_NAME = 'clawhub-cli'
const ACCOUNT_NAME = 'auth-token'
const ALGORITHM = 'aes-256-gcm'

// Keytar is optional - we'll dynamically import it
let keytarModule: typeof import('keytar') | null = null
let keytarLoadAttempted = false

/**
 * Attempt to load keytar for native keychain access
 */
async function getKeytar(): Promise<typeof import('keytar') | null> {
  if (keytarLoadAttempted) return keytarModule

  keytarLoadAttempted = true
  try {
    // Dynamic import - keytar may not be installed
    keytarModule = await import('keytar')
    return keytarModule
  } catch {
    // keytar not available - will use encrypted file fallback
    return null
  }
}

/**
 * Get a machine-specific key derivation salt
 * This ensures encrypted tokens can only be decrypted on the same machine
 */
function getMachineKey(): Buffer {
  const machineId = `${hostname()}-${userInfo().username}-${homedir()}`
  return scryptSync(machineId, 'clawhub-salt-v1', 32)
}

/**
 * Get path for encrypted token file (fallback storage)
 */
function getEncryptedTokenPath(): string {
  const home = homedir()
  if (process.platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'clawhub', '.token.enc')
  }
  const xdg = process.env.XDG_DATA_HOME
  if (xdg) {
    return join(xdg, 'clawhub', '.token.enc')
  }
  if (process.platform === 'win32') {
    const appData = process.env.LOCALAPPDATA || process.env.APPDATA
    if (appData) {
      return join(appData, 'clawhub', '.token.enc')
    }
  }
  return join(home, '.local', 'share', 'clawhub', '.token.enc')
}

/**
 * Get legacy plaintext config path (for migration)
 */
function getLegacyConfigPath(): string {
  const home = homedir()
  if (process.platform === 'darwin') {
    const clawhubPath = join(home, 'Library', 'Application Support', 'clawhub', 'config.json')
    if (existsSync(clawhubPath)) return clawhubPath
    return join(home, 'Library', 'Application Support', 'clawdhub', 'config.json')
  }
  const xdg = process.env.XDG_CONFIG_HOME
  if (xdg) {
    const clawhubPath = join(xdg, 'clawhub', 'config.json')
    if (existsSync(clawhubPath)) return clawhubPath
    return join(xdg, 'clawdhub', 'config.json')
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA
    if (appData) {
      const clawhubPath = join(appData, 'clawhub', 'config.json')
      if (existsSync(clawhubPath)) return clawhubPath
      return join(appData, 'clawdhub', 'config.json')
    }
  }
  const clawhubPath = join(home, '.config', 'clawhub', 'config.json')
  if (existsSync(clawhubPath)) return clawhubPath
  return join(home, '.config', 'clawdhub', 'config.json')
}

/**
 * Migrate token from legacy plaintext config to secure storage
 * Returns true if migration was performed
 */
async function migrateLegacyToken(): Promise<string | null> {
  const legacyPath = getLegacyConfigPath()
  if (!existsSync(legacyPath)) return null
  
  try {
    const raw = await readFile(legacyPath, 'utf8')
    const parsed = JSON.parse(raw) as { token?: string; registry?: string }
    const token = parsed.token?.trim()
    
    if (!token) return null
    
    // Found legacy plaintext token - migrate it
    console.warn('⚠️  Migrating plaintext token to secure storage...')
    
    // Store in secure storage
    await storeToken(token)
    
    // Remove token from plaintext config (keep registry)
    const updated = { registry: parsed.registry }
    await writeFile(legacyPath, JSON.stringify(updated, null, 2) + '\n', 'utf8')
    
    console.warn('✅ Token migrated to secure storage. Plaintext token removed.')
    return token
  } catch {
    return null
  }
}

/**
 * Encrypt a token using AES-256-GCM with machine-derived key
 */
function encryptToken(token: string): Buffer {
  const key = getMachineKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ])

  const authTag = cipher.getAuthTag()

  // Format: [16 bytes IV][16 bytes authTag][encrypted data]
  return Buffer.concat([iv, authTag, encrypted])
}

/**
 * Decrypt a token using AES-256-GCM with machine-derived key
 */
function decryptToken(data: Buffer): string | null {
  try {
    const key = getMachineKey()
    const iv = data.subarray(0, 16)
    const authTag = data.subarray(16, 32)
    const encrypted = data.subarray(32)

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  } catch {
    // Decryption failed - likely wrong machine or corrupted data
    return null
  }
}

/**
 * Store token in encrypted file (fallback when keytar unavailable)
 */
async function storeTokenEncryptedFile(token: string): Promise<void> {
  const path = getEncryptedTokenPath()
  await mkdir(dirname(path), { recursive: true })

  const encrypted = encryptToken(token)
  await writeFile(path, encrypted, { mode: 0o600 }) // Owner read/write only
}

/**
 * Read token from encrypted file (fallback when keytar unavailable)
 */
async function readTokenEncryptedFile(): Promise<string | null> {
  const path = getEncryptedTokenPath()
  if (!existsSync(path)) return null

  try {
    const data = await readFile(path)
    return decryptToken(data)
  } catch {
    return null
  }
}

/**
 * Delete token from encrypted file
 */
async function deleteTokenEncryptedFile(): Promise<void> {
  const path = getEncryptedTokenPath()
  if (existsSync(path)) {
    await unlink(path)
  }
}

/**
 * Store authentication token securely
 * Uses OS keychain if available, falls back to encrypted file
 */
export async function storeToken(token: string): Promise<void> {
  const keytar = await getKeytar()

  if (keytar) {
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token)
    // Also clean up any legacy encrypted file
    await deleteTokenEncryptedFile().catch(() => {})
  } else {
    // Fallback to encrypted file storage
    await storeTokenEncryptedFile(token)
  }
}

/**
 * Retrieve authentication token securely
 * Uses OS keychain if available, falls back to encrypted file
 * Also handles migration from legacy plaintext storage
 */
export async function getToken(): Promise<string | null> {
  const keytar = await getKeytar()

  if (keytar) {
    const token = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
    if (token) return token

    // Check for encrypted file fallback (migration scenario)
    const fileToken = await readTokenEncryptedFile()
    if (fileToken) {
      // Migrate to keychain
      await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, fileToken)
      await deleteTokenEncryptedFile().catch(() => {})
      return fileToken
    }

    // Check for legacy plaintext config (security migration)
    const legacyToken = await migrateLegacyToken()
    if (legacyToken) return legacyToken

    return null
  }

  // Fallback to encrypted file storage
  const encryptedToken = await readTokenEncryptedFile()
  if (encryptedToken) return encryptedToken

  // Check for legacy plaintext config (security migration)
  return migrateLegacyToken()
}

/**
 * Delete stored authentication token
 */
export async function deleteToken(): Promise<void> {
  const keytar = await getKeytar()

  if (keytar) {
    await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME)
  }

  // Always try to clean up encrypted file too
  await deleteTokenEncryptedFile().catch(() => {})
}

/**
 * Check if secure storage is available (keytar installed)
 * Useful for displaying warnings to users
 */
export async function hasKeychainSupport(): Promise<boolean> {
  const keytar = await getKeytar()
  return keytar !== null
}

/**
 * Get storage type description for user information
 */
export async function getStorageType(): Promise<string> {
  const keytar = await getKeytar()
  if (keytar) {
    switch (process.platform) {
      case 'darwin':
        return 'macOS Keychain'
      case 'win32':
        return 'Windows Credential Vault'
      default:
        return 'System Keyring (libsecret)'
    }
  }
  return 'Encrypted file storage'
}
