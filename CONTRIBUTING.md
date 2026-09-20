# Contributing

## Local development

Use Node.js 22 and the committed lockfiles:

```sh
npm ci
npm --prefix api ci
npm run dev
```

The default frontend is a local demo; no Azure credentials are needed. Copy
`.env.example` to `.env` only when changing local configuration. On Windows,
use `npm.cmd` and `npx.cmd` if PowerShell blocks the `.ps1` wrappers.

## Verification

```sh
npm test
npm run build
npm --prefix api run build
npx playwright install chromium
npm run test:e2e
```

The optional `npm run test:integration` requires `COSMOS_ENDPOINT`, `COSMOS_KEY`
and optionally `COSMOS_DATABASE` in the process environment. It builds the API,
creates temporary users and a temporary home in the selected database, checks
authorization and photo persistence, then removes only its generated records.
It calls the handler directly and does not test a real Microsoft browser login.
Use an isolated test database when available. Do not put credentials into files
tracked by Git. Ordinary CI does not run this live test.

## Project conventions

Keep platform authorisation and home membership separate. Every household write must produce a server-authored audit event in the same home transaction. Fetch photo data only through the authorised API. Never trust browser role fields. Platform account changes do not currently have audit history.

Test small-screen widths, keyboard operation, dark mode, deep links and long labels. Keep demo status unmistakable. Document unfinished features instead of presenting them as secure production capabilities.

Documentation screenshots come from fictional demo data. To refresh them, start
`npm run dev`, install Chromium with `npx playwright install chromium`, then
run `node scripts/capture-docs.mjs`. Set `DOCS_BASE_URL` for a different local
port, or `CHROME_PATH` to use an existing Chrome executable. Review every image
before adding it to a public pull request.

Keep runtime code in `src/` and `api/src/`, tests in `tests/`, Azure policy in
`infra/azure/`, and build helpers in `scripts/`. Do not commit `dist/`, test
reports, `node_modules/`, `.env` files or `api/local.settings.json`.

Deployment is manual through the `Deploy Azure` workflow after the
`production` environment is configured. Keep environment-specific
addresses, resource IDs and credentials out of this repository.
