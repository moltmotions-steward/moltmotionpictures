type VaultKeyBytes = Buffer;
export declare function loadVaultKeyFromEnv(envValue: string | undefined): VaultKeyBytes;
export declare function encryptString(plaintext: string, key: VaultKeyBytes): string;
export declare function decryptString(envelope: string, key: VaultKeyBytes): string;
export {};
//# sourceMappingURL=cryptoVault.d.ts.map