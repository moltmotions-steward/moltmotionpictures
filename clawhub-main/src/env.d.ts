/// <reference lib="dom" />

// Minimal Vite-like types to avoid depending on `vite/client` resolution.
interface ImportMetaEnv {
  readonly [key: string]: string | boolean | number | undefined;
}

declare global {
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  // Minimal Vitest global typings; tests can still prefer importing from `vitest`.
  // These are intentionally loose to avoid module-resolution coupling.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const describe: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const it: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const test: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expect: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beforeAll: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const afterAll: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beforeEach: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const afterEach: any;
}

export {};
