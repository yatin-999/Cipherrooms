import _sodium from 'libsodium-wrappers';

export const initCrypto = async () => {
  await _sodium.ready;
};

export const deriveKEK = async (password: string, saltHex: string): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  await _sodium.ready;
  const salt = _sodium.from_hex(saltHex);

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

export const generateSalt = async () => {
  await _sodium.ready;
  return _sodium.to_hex(window.crypto.getRandomValues(new Uint8Array(16)));
};

export const generateKeypair = async () => {
  await _sodium.ready;
  const sodium = _sodium;
  const edKeyPair = sodium.crypto_sign_keypair();
  
  const xPublicKey = sodium.crypto_sign_ed25519_pk_to_curve25519(edKeyPair.publicKey);
  
  return {
    edPublicKey: sodium.to_hex(edKeyPair.publicKey),
    edPrivateKey: sodium.to_hex(edKeyPair.privateKey),
    xPublicKey: sodium.to_hex(xPublicKey),
  };
};

export const encryptPrivateKey = async (privateKeyHex: string, kek: CryptoKey) => {
  await _sodium.ready;
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(privateKeyHex);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    kek,
    data
  );
  return {
    ciphertext: _sodium.to_hex(new Uint8Array(encrypted)),
    iv: _sodium.to_hex(iv),
  };
};

export const decryptPrivateKey = async (encryptedHex: string, ivHex: string, kek: CryptoKey) => {
  await _sodium.ready;
  const encryptedData = _sodium.from_hex(encryptedHex);
  const iv = _sodium.from_hex(ivHex);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    kek,
    encryptedData
  );
  return new TextDecoder().decode(decrypted);
};

export interface EncryptedMessagePayload {
  ciphertext: string;
  iv: string;
  encryptedKeys: Record<string, string>;
  signature: string;
}

export const encryptMessage = async (
  plaintext: string,
  recipientPublicKeys: Record<string, string>, 
  senderEdPrivateKeyHex: string
): Promise<EncryptedMessagePayload> => {
  await _sodium.ready;
  const sodium = _sodium;

  const aesKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, 
    ['encrypt', 'decrypt']
  );
  const rawAesKey = await window.crypto.subtle.exportKey('raw', aesKey);

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(plaintext);
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encodedText
  );
  const ciphertext = sodium.to_hex(new Uint8Array(ciphertextBuffer));
  const ivHex = sodium.to_hex(iv);

  const encryptedKeys: Record<string, string> = {};
  for (const [userId, pubKeyHex] of Object.entries(recipientPublicKeys)) {
    const recipientPubKey = sodium.from_hex(pubKeyHex);
    const encryptedRawKey = sodium.crypto_box_seal(new Uint8Array(rawAesKey), recipientPubKey);
    encryptedKeys[userId] = sodium.to_hex(encryptedRawKey);
  }

  const payloadToSign = ciphertext + ivHex;
  const senderEdPrivateKey = sodium.from_hex(senderEdPrivateKeyHex);
  const signature = sodium.crypto_sign_detached(new TextEncoder().encode(payloadToSign), senderEdPrivateKey);
  const signatureHex = sodium.to_hex(signature);

  return {
    ciphertext,
    iv: ivHex,
    encryptedKeys,
    signature: signatureHex,
  };
};

export const decryptMessage = async (
  payload: EncryptedMessagePayload,
  myUserId: string,
  myEdPrivateKeyHex: string, 
  senderEdPublicKeyHex: string
): Promise<string> => {
  await _sodium.ready;
  const sodium = _sodium;

  const payloadToVerify = payload.ciphertext + payload.iv;
  const senderEdPublicKey = sodium.from_hex(senderEdPublicKeyHex);
  const signatureBytes = sodium.from_hex(payload.signature);
  
  const isValid = sodium.crypto_sign_verify_detached(
    signatureBytes,
    new TextEncoder().encode(payloadToVerify),
    senderEdPublicKey
  );
  if (!isValid) throw new Error('Invalid signature');

  const myEncryptedKeyHex = payload.encryptedKeys[myUserId];
  if (!myEncryptedKeyHex) throw new Error('Not encrypted for this user');

  const myEdPrivateKey = sodium.from_hex(myEdPrivateKeyHex);
  const myXPrivateKey = sodium.crypto_sign_ed25519_sk_to_curve25519(myEdPrivateKey);
  const myXPublicKey = sodium.crypto_scalarmult_base(myXPrivateKey);
  
  const encryptedRawKey = sodium.from_hex(myEncryptedKeyHex);
  
  const rawAesKey = sodium.crypto_box_seal_open(
    encryptedRawKey,
    myXPublicKey,
    myXPrivateKey
  );
  if (!rawAesKey) throw new Error('Failed to decrypt AES key');

  const aesKey = await window.crypto.subtle.importKey(
    'raw',
    rawAesKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const iv = sodium.from_hex(payload.iv);
  const ciphertext = sodium.from_hex(payload.ciphertext);
  const plaintextBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  );

  return new TextDecoder().decode(plaintextBuffer);
};
