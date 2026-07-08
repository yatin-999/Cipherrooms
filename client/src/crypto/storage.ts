import { openDB } from 'idb';

const DB_NAME = 'cipherrooms-crypto';
const STORE_NAME = 'keys';

const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
};

export const storeEncryptedPrivateKey = async (userId: string, data: { ciphertext: string, iv: string, salt: string }) => {
  const db = await initDB();
  await db.put(STORE_NAME, data, `private_key_${userId}`);
};

export const getEncryptedPrivateKey = async (userId: string): Promise<{ ciphertext: string, iv: string, salt: string } | undefined> => {
  const db = await initDB();
  return db.get(STORE_NAME, `private_key_${userId}`);
};

export const clearPrivateKey = async (userId: string) => {
  const db = await initDB();
  await db.delete(STORE_NAME, `private_key_${userId}`);
};
