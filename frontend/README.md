# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Wireframe styling and icons

The app uses the supplied `wireframe.png` as a visual reference: white surfaces,
compact bordered forms and tables, a flat sidebar, and a shared authentication shell.
Only implemented routes are shown; illustration-only reports/supplier screens are
not added as inactive navigation links.

Import icons from `src/components/ui/icons.tsx`. This shared Lucide React adapter
sets `strokeWidth={1.5}`, inherits parent text color, and restricts sizes to
12 (xs), 14 (sm), 16 (default), 20 (md), and 24 (lg). Apply semantic color to the
parent element. Do not add emoji icons or another icon library.

Run the backend on port 8000, then run `npm ci` and `npm run dev` here.
Open http://127.0.0.1:3000. Vite forwards `/api` requests to the backend.
