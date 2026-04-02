/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_YMAPS_API_KEY: string;
  readonly VITE_ENABLE_TEST_ORDER_RECEIPT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
