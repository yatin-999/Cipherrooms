import { create } from 'zustand'

export interface User {
  _id: string
  username: string
  email: string
  publicKey: string // Crucial for E2EE
  avatar: string
  status: string
}

interface AuthState {
  user: User | null
  accessToken: string | null
  privateKey: string | null // Crucial for E2EE decryption
  isLoading: boolean
  setAccessToken: (token: string) => void
  setUser: (user: User) => void
  setPrivateKey: (key: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  privateKey: null,
  isLoading: true,

  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user }),
  setPrivateKey: (key) => set({ privateKey: key }),

  logout: () => set({ user: null, accessToken: null, privateKey: null }),
}))
