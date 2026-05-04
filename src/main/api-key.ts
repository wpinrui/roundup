/**
 * API-key persistence.
 *
 * Storage: a single file `<userData>/api-key.bin` containing the safeStorage-
 * encrypted bytes. Plaintext is never written to disk.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { encryptApiKey, loadApiKey } from './secrets'

const FILE_NAME = 'api-key.bin'

function keyPath(userDataDir: string): string {
  return path.join(userDataDir, FILE_NAME)
}

export function saveApiKey(userDataDir: string, plaintext: string): void {
  const encrypted = encryptApiKey(plaintext)
  writeFileSync(keyPath(userDataDir), encrypted)
}

export function getStoredApiKey(userDataDir: string): string | null {
  const file = keyPath(userDataDir)
  if (!existsSync(file)) return null
  const bytes = readFileSync(file)
  return loadApiKey(bytes)
}
