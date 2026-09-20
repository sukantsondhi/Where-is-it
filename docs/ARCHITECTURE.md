# Architecture

## Request path

React/Vite frontend → same-origin SWA managed Functions → active platform user lookup → home membership → Cosmos inventory or photo access.

Microsoft accounts authenticate through SWA's built-in provider on the Free plan. Any Microsoft account can sign in, but the API requires explicit approval. APIs authorise the trusted SWA user ID bound to an active account, never a client-submitted role. Invitation acceptance requires both the emailed secret and a matching trusted SWA account email. The managed API must not be independently exposed.

## Data

The users container partitions by user ID. Each user stores a display name, exact-match email label, platform role and invited/active/disabled status. Invited accounts use a deterministic email-hash ID to prevent duplicate invitations; acceptance binds a SWA ID without changing the account ID. Legacy accounts retain their existing SWA IDs. Invitation secrets are stored only as hashes, expire after seven days, and are removed on acceptance. Conditional ETag writes prevent concurrent acceptance, resend or disable operations from overwriting each other. Internal identity and invitation fields are excluded from API responses.

The inventory container partitions by home ID:

- One home document holds the hierarchy and member IDs.
- A separate audit document is created for every home mutation.
- One separate photo document per item stores compressed WebP data; it is excluded from state queries and fetched only after membership checks. Photo updates and deletions are atomic with inventory/audit writes.
- Inventory replacement uses the Cosmos ETag to prevent lost writes.
- Inventory replacement and audit creation are a single transactional batch.
- Owner ID is held outside the editable home payload. Returned home role is derived server-side.
- Every generated home/location/item ID is random and persists across renames.
- Rate counter documents use separate `rate-*` partitions in inventory. Conditional ETag writes enforce per-identity limits across API instances.
- Platform audit intent documents use the `platform-admin` partition. Only the super admin may retrieve the newest 500 through `/api/admin/audit`.

This optimises for small homes, not enormous inventories. Upgrade to per-entity documents and paging before exceeding the documented v1 limits.

## Routes

| Route | Method | Permission |
| --- | --- | --- |
| /api/state | GET | Active user; only their homes, profiles of fellow members, owner-only logs |
| /api/commands | POST | Active member; owner required for membership changes |
| /api/photos | GET, POST | Active member of the item's home |
| /api/admin/users | GET | Platform administrator |
| /api/admin/users | POST | Admin; email invitation, only super-admin can invite co-admin |
| /api/invitations/accept | POST | Signed-in Microsoft account matching the invited email plus unexpired invitation token |
| /api/admin/users | PATCH | Admin constrained by target role; super-admin protected |
| /api/admin/audit | GET | Super-admin; newest 500 platform change attempts |

Platform user management does not query inventory. Being an administrator does not bypass membership checks.

## UX

Homes dashboard → room → storage → item. All-items search spans only current memberships. QR links select the precise location after authentication. Empty states provide next-step guidance; dialogs use native modal focus containment; touch targets, reduced motion and responsive layouts are implemented. Photo compression happens on the device before upload.

The browser demo shares the domain command engine with the backend, but **demo roles are not a security boundary**. Local storage can be edited by the browser owner.

## Audit and deletion

Audit records are append-only via the API but not WORM. Item deletion removes active inventory and logs the action; restoration, tombstones and backup-driven UI recovery are not implemented. Room/storage deletion requires emptiness. Photographs are private Cosmos documents; replacing a photo overwrites its document and deleting an item deletes its photo in the same transaction.

Platform audit records are written before user changes. They record an intent, including attempts that later fail. User documents and platform audit documents occupy different Cosmos partitions, so their writes cannot form one atomic batch. A missing audit store blocks a new change, but these records are not a tamper-proof or completion-certified history.

## Deployment boundary

CI runs domain tests, frontend typechecking/build, API build and Chromium browser tests. Azure deployment is manual through the `Deploy Azure` workflow and requires the `production` environment token plus `AZURE_ENABLED=true`. Neither Azure accounts nor resources are created by the repository workflow. Azure policy files are in `infra/azure`; the opt-in live API test is in `tests/integration`.
