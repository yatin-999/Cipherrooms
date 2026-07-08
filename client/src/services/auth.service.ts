import api from './api'
import { useAuthStore } from '../store/auth.store'
import _sodium from 'libsodium-wrappers'
import { 
  initCrypto, 
  generateKeypair, 
  deriveKEK, 
  encryptPrivateKey,
  decryptPrivateKey
} from '../crypto'
import { storeEncryptedPrivateKey, getEncryptedPrivateKey } from '../crypto/storage'

export async function register(username: string, email: string, password: string) {
  // 1. Setup E2EE Keys
  await initCrypto();
  const keypair = await generateKeypair();
  
  const saltBytes = _sodium.crypto_generichash(16, new TextEncoder().encode(email.toLowerCase()));
  const saltHex = _sodium.to_hex(saltBytes);
  
  const kek = await deriveKEK(password, saltHex);
  const encryptedPriv = await encryptPrivateKey(keypair.edPrivateKey, kek);

  const publicKeyPayload = JSON.stringify({
    edPublicKey: keypair.edPublicKey,
    xPublicKey: keypair.xPublicKey
  });

  // 2. Call API
  const { data } = await api.post('/auth/register', { 
    username, 
    email, 
    password,
    publicKey: publicKeyPayload 
  })

  // 3. Store Encrypted Vault
  await storeEncryptedPrivateKey(data.user._id, {
    ciphertext: encryptedPriv.ciphertext,
    iv: encryptedPriv.iv,
    salt: saltHex
  });

  // 4. Update Global State
  useAuthStore.getState().setAccessToken(data.accessToken)
  useAuthStore.getState().setUser(data.user)
  useAuthStore.getState().setPrivateKey(keypair.edPrivateKey)
  return data
}

export async function login(email: string, password: string) {
  const { data } = await api.post('/auth/login', { email, password })
  
  // E2EE Decryption
  let privateKey = null;
  const storedKeyData = await getEncryptedPrivateKey(data.user._id);
  if (storedKeyData) {
    await initCrypto();
    const kek = await deriveKEK(password, storedKeyData.salt);
    try {
      privateKey = await decryptPrivateKey(storedKeyData.ciphertext, storedKeyData.iv, kek);
    } catch (decryptErr) {
      console.error("Failed to decrypt local key. Password correct, but vault corrupted.", decryptErr);
    }
  }

  useAuthStore.getState().setAccessToken(data.accessToken)
  useAuthStore.getState().setUser(data.user)
  if (privateKey) useAuthStore.getState().setPrivateKey(privateKey)
  
  return data
}

export async function logout() {
  await api.post('/auth/logout')
  useAuthStore.getState().logout()
}

// Called once on app startup to restore session from cookie
export async function restoreSession() {
  try {
    const { data } = await api.post('/auth/refresh')
    useAuthStore.getState().setAccessToken(data.accessToken)
    const me = await api.get('/auth/me')
    useAuthStore.getState().setUser(me.data.user)
    
    // Note: We cannot restore the privateKey automatically here because we need the plaintext password!
    // The user will remain "logged in" but in a "locked" state until they unlock the vault in the UI.
  } catch {
    // No valid session — user needs to log in
  } finally {
    useAuthStore.setState({ isLoading: false })
  }
}
