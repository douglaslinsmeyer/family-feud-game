/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PERSISTENCE: 'memory' | 'ddb';
  readonly VITE_AWS_REGION?: string;
  readonly VITE_COGNITO_IDENTITY_POOL_ID?: string;
  readonly VITE_DDB_TABLE_NAME?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }
