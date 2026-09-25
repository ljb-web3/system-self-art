# React + TypeScript + Vite

## SYSTEM LOG semantics

SYSTEM LOG is backed by `20260924000000_system_log.sql`, a deliberately limited public ledger separate from the private experimental tables. Public reads are available only through the paginated `get_public_system_events` RPC. Direct anonymous table reads and all direct event writes are denied.

- Public SELF IDs are unique random six-digit numbers. They are stored in a private UUID-to-public-ID mapping and are not derived from the internal UUID.
- `ENTERED` is recorded at most once per persistent SELF in a rolling 30-minute window. The check and timestamp update are serialized in the database, so reloads, reconnects, concurrent tabs, and retries cannot create an entry storm.
- `CONNECTED` is the single event created by insertion of the canonical two-person session. A spontaneous session is inserted only after the target accepts and the requester receives and acknowledges that acceptance. A scheduled session is inserted by the existing atomic scheduled matcher.
- `REFUSED` is created only by the credentialed target's explicit decline RPC before the request expires. Timeout, tab closure, Presence loss, and network failure do not call that path.
- `JOINED NEXT CONNECTION` is created by the first insertion of the unique `(self_id, slot_at)` scheduled invitation. Returning the same invitation does not insert another event.
- Event idempotency is enforced by unique private source keys in addition to the canonical session/request/invitation constraints.
- The UI requests 12 rows per desktop page and 8 per mobile page. Both the global ledger and exact public-SELF search are server-paginated and ordered newest first.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
