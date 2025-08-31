declare module "secure-web-storage" {
  export default class SecureStorage {
    constructor(storage: Storage, options: { hash: Function; encrypt: Function; decrypt: Function });
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  }
}
