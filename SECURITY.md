# Security

Do not publish sensitive inventory, secrets, household screenshots, or user IDs in public issues.

Report security concerns through GitHub's **Report a vulnerability** button on the repository's Security tab once private vulnerability reporting is enabled. If that option is unavailable, contact the repository owner privately; do not post exploit details, keys, user IDs, or inventory in a public issue.

## Supported boundary

Production API requires Azure Static Web Apps managed Functions, built-in Microsoft authentication, and an active approved user record. Never publish the API independently: the SWA identity header is trusted only behind SWA's managed ingress.

Each deployer supplies a Cosmos account dedicated to this app and stores its account key in server-side Azure application settings. The key grants account-wide access if leaked. Managed Static Web Apps Functions do not support managed identity for their API; eliminating the key requires a different hosting design.

All home operations re-check membership. Platform roles grant no home access. Home audit records are owner-only. Photos are private and served through authorised APIs. Mutations require same-origin JSON. Cosmos ETags and atomic inventory/audit batches prevent lost writes.

Cosmos-backed per-identity limits allow 60 reads and 20 writes per minute, plus five invitation attempts per administrator per hour. The limit is shared across managed API instances. A super admin can download the newest 500 platform change attempts from Administration. These records are written before account changes, so an unavailable audit store blocks the change; an attempt record does not prove the change completed.

Any Microsoft account can sign in with the built-in provider. Sign-in alone grants no inventory access: the API requires an active account bound to the trusted SWA user ID. Tenant assignment is not an access boundary on the Free plan. GitHub sign-in is blocked.

## Not guaranteed

This is not end-to-end encrypted, WORM-compliant, independently penetration-tested, or a guarantee against compromised infrastructure credentials. Tenant operators can inspect stored data. Browser demo mode is unauthenticated. No service worker caches private inventory.

Complete the multi-user checks in the Azure setup guide before storing sensitive data. Review dependency updates together with both committed lockfiles; CI installs with `npm ci`.

## Known v1 limits

No recovery UI, pagination, IP-wide request throttling, image malware scanning, or tamper-proof platform audit. Built-in Azure protections do not replace application abuse controls for larger deployments. Photo replacement and deletion are transactional with inventory updates.
