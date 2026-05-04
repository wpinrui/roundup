/// <reference types="vite/client" />

import type { RoundupAPI } from '../../shared/ipc'

declare global {
  interface Window {
    api: RoundupAPI
  }
}
