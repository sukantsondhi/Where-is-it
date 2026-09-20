# Public release checklist

Use this just before the first public commit and before switching GitHub visibility.

1. Delete the local, Git-ignored `VULNERABILITIES.md` after using it to fix the original project. It is excluded by `.gitignore`, but check `git status` anyway.
2. Run `rg -n -i 'key|secret|token|connection.string|azurestaticapps.net|@' --glob '!package-lock.json' --glob '!api/package-lock.json' .` and review every result, including test fixtures, docs, and screenshots. Check `git diff --cached` before committing. Do not commit local `.env` or `api/local.settings.json`.
3. Run `npm audit` in the root and `api/`, plus the tests and both builds in [Contributing](../CONTRIBUTING.md). Recheck the generated screenshots for personal or live data.
4. In GitHub **Settings → Code security and analysis**, enable secret scanning, push protection if available, Dependabot alerts and security updates. Enable **private vulnerability reporting** so [SECURITY.md](../SECURITY.md) has a usable private channel.
5. Protect `main` with required CI checks and pull request review. Limit who can edit the `production` environment and its deployment token. The Azure workflow is manual.
6. Keep the new Azure deployment token in the `production` environment secret. Never reuse the old site's token. Before inviting real users, complete [Azure deployment validation](AZURE_SETUP.md#7-invite-and-verify).

No configuration can promise that all vulnerabilities are absent. Revisit dependency advisories and Azure costs after release.
