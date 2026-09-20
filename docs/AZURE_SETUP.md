# Deploy Where Is It to Azure

This guide creates a fresh deployment in **your** Azure subscription. Allow about an hour for the portal work. You need a GitHub account, a Microsoft account for Azure, and a Microsoft account that will become the app's first administrator. They may be the same account.

> **Choose the first administrator now:** Which Microsoft account will sign in to the new site first? Record its exact sign-in email privately. During [step 6](#6-choose-the-first-platform-administrator), sign in with that account and copy its Static Web Apps user ID. Never put the email or ID in GitHub files.

## Services and costs

| Service | Purpose | Cost boundary |
| --- | --- | --- |
| [Azure Static Web Apps Free](https://learn.microsoft.com/en-us/azure/static-web-apps/plans) | React site, HTTPS, Microsoft sign in, managed Functions API | Free plan within its [quotas](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas); no SLA |
| [Azure Cosmos DB for NoSQL free tier](https://learn.microsoft.com/en-us/azure/cosmos-db/free-tier) | Users, homes, items, photos and activity | **Opt in at account creation.** First 1,000 RU/s and 25 GB in one eligible account per subscription; excess usage is billed |
| [Azure Communication Services Email](https://learn.microsoft.com/en-us/azure/communication-services/concepts/email-pricing) | Invitation email | Sending is **pay as you go**; an Azure managed domain has no provisioning charge |
| GitHub Actions | Builds and sends the app to Static Web Apps | Subject to your GitHub plan's Actions allowances |

An Azure subscription is a billing boundary, **not** a blanket free account. Each subscription can have **up to one** Cosmos DB free tier account, if eligible and selected when that account is created. Use a subscription with no free tier Cosmos account, or create a new eligible subscription. Keep this app in its **own Cosmos account**: the API's account key grants access to the whole account, so sharing one with unrelated data broadens the impact of a leaked key. Creating extra subscriptions may require a paid billing offer. Do not choose Cosmos **Serverless** for this guide; its free tier is unavailable. Set a [Cost Management budget](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets) with email alerts. A budget alerts you; it does not stop charges.

## 1. Create or select a subscription

1. If you have no Azure account, [start with Azure's account sign-up](https://azure.microsoft.com/free/). Follow its identity and payment verification. Trial credits and eligibility vary. If you already have access, open [Azure portal](https://portal.azure.com/) and search for **Subscriptions**.
2. Select an **Active** subscription that you control. Search its resources for **Azure Cosmos DB**. In each Cosmos account's Overview, check whether **Free Tier Discount** is enabled. If that subscription already has a free tier Cosmos account, select a different eligible subscription for this app.
3. If you need a new subscription, open **Subscriptions → Add**, select an offer you are eligible for, review its billing terms, and create it. Make sure the portal's subscription filter is set to the one you chose before creating resources.
4. Search for **Resource groups → Create**. Choose your subscription, a nearby region, and a name such as `rg-where-is-it`. Put all resources in this group so they are easy to find.

## 2. Create Cosmos DB

1. In the portal, select **Create a resource → Azure Cosmos DB → Azure Cosmos DB for NoSQL → Create**. Choose your subscription and resource group.
2. Give the account a globally unique name, choose one region near your users, **Provisioned throughput**, and **Apply Free Tier Discount**. If that option is missing, stop and resolve subscription eligibility before proceeding. Review the estimated cost before **Create**. See [Microsoft's account guide](https://learn.microsoft.com/en-us/azure/cosmos-db/how-to-create-account).
3. Open the new account's **Data Explorer → New Container**. Create database `where-is-it` with **shared provisioned throughput, 400 RU/s**. Create container `users` with partition key `/id`.
4. In the same database, create container `inventory` with partition key `/homeId`. Keep throughput **shared at the database**, not dedicated per container.
5. Open the inventory container's **Settings / Indexing Policy**. Apply [this policy](../infra/azure/inventory-indexing-policy.json) to exclude the base64 photo field from indexing. Save and wait for the update.
6. In Cosmos **Keys**, copy the **URI** and a **read-write key** into a private password manager for step 5. Never paste them in GitHub, screenshots, issues, or a `VITE_` variable.

The API uses key authentication because managed Static Web Apps Functions do not offer managed identity to Cosmos. This keeps the public template on the Free hosting plan; each fork deploys into its owner's Azure resources. The key stays in that owner's server-side Azure settings and must never enter the fork or a browser build. Use a dedicated Cosmos account, restrict who can view its key in Azure, and rotate the key if exposed. A separately deployed Function with managed identity is an option for operators who accept a more complex deployment and potentially different costs. The database name and container partition keys must match exactly.
The inventory container also holds small rate counter and platform audit records. They share the same 400 RU/s with home inventory, so watch throughput as usage grows.

## 3. Create the Static Web App

1. Search **Static Web Apps → Create**. Choose the same subscription and resource group, a unique site name, and plan **Free**.
2. For deployment source, choose **Other** if the portal offers it. This repository already contains the required GitHub workflow; Azure's generated workflow is unnecessary. If your portal flow requires **GitHub**, select your new repository and then remove the generated workflow before enabling deployment, keeping only [`azure.yml`](../.github/workflows/azure.yml). Do not connect the old private repository.
3. Create the site. On its **Overview**, copy the default HTTPS URL (the origin, without a final `/`).
4. Open **Manage deployment token** and copy the token privately. In the new GitHub repository, open **Settings → Environments → New environment**, name it `production`, then add environment secret `AZURE_STATIC_WEB_APPS_API_TOKEN`. Do not place the token in a repository variable or file. [Microsoft explains deployment tokens](https://learn.microsoft.com/en-us/azure/static-web-apps/deployment-token-management).

The site's managed Functions API must stay attached to Static Web Apps. Do not publish `api/` as a separate public Azure Function; it trusts an identity header supplied by the Static Web Apps ingress.

## 4. Configure invitation email

Invitations cannot be sent until this step is complete. Email sending incurs usage charges.

1. Search **Email Communication Services → Create**. Use the same subscription and resource group, and choose the data geography you need.
2. Open it, select **Provision Domains → Add domain → Azure domain**. Wait for the Azure managed domain to be ready. See [Microsoft's domain guide](https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/email/add-azure-managed-domains).
3. Search **Communication Services → Create** in the same data geography. Open its **Email → Domains → Connect domain**, select the verified managed domain, and connect it. [Microsoft's linking guide](https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/email/connect-email-communication-resource) shows the portal flow.
4. In the Communication Service, copy its connection string privately. In the managed domain, find the approved sender address (often `DoNotReply@...azurecomm.net`). Both go into application settings in step 5.

## 5. Add server-side settings and deploy

In the Static Web App, open **Configuration → Application settings** and add these names. Azure stores their values; GitHub does not.

| Name | Value |
| --- | --- |
| `COSMOS_ENDPOINT` | Cosmos account URI from step 2 |
| `COSMOS_KEY` | Cosmos read-write key from step 2 |
| `COSMOS_DATABASE` | `where-is-it` |
| `APP_ORIGIN` | Exact Static Web App HTTPS origin from step 3, no trailing slash |
| `AUTH_BOUNDARY` | `swa-managed` |
| `ACS_EMAIL_CONNECTION_STRING` | Communication Service connection string |
| `INVITE_FROM` | Approved sender email address |

Do not use `VITE_` on any secret: Vite embeds those values in public browser files. The frontend always calls the same-origin `/api` path; no API host, Cosmos endpoint, or key belongs in the frontend `.env`. For local backend development, copy `api/local.settings.example.json` to the Git-ignored `api/local.settings.json` and fill it privately. Production backend values go in Azure Static Web App application settings, not that local file.

Run local checks from the repository root:

```sh
npm ci
npm --prefix api ci
npm test
npm run test:invitations
npm run build
npm --prefix api run build
```

In GitHub, open **Settings → Secrets and variables → Actions → Variables** and add `AZURE_ENABLED` = `true`. Then run **Actions → Deploy Azure → Run workflow** on `main`. The workflow builds with `VITE_DATA_MODE=azure`, uploads the UI and API, and uses the `production` environment token. Wait for a green run before opening the site. Later releases use the same manual workflow, so a public pull request or push cannot deploy by itself.

## 6. Choose the first platform administrator

Use the Microsoft account you chose at the top of this guide. Do this only after the site and API are deployed.

1. In a private browser window, visit `YOUR_SITE/.auth/login/aad` and sign in with that Microsoft account.
2. Open `YOUR_SITE/.auth/me`. Find `clientPrincipal.userId`. Copy **only** that user ID privately. It is a Static Web Apps ID, **not** an Entra Object ID.
3. In the Static Web App's **Configuration → Application settings**, temporarily add `BOOTSTRAP_USER_ID` = that exact ID, `BOOTSTRAP_NAME` = the person's display name, and `BOOTSTRAP_EMAIL` = their sign-in email. Save.
4. Reload the app in the same signed-in browser. Its first API request creates that person as the super admin in Cosmos. Confirm **Administration** appears and the user is listed as active.
5. Immediately remove all three `BOOTSTRAP_*` settings and save. Reload once more to confirm access persists.

Never bootstrap an ID copied from another person's session. Changing providers or recreating the site may change IDs. This step does not give the person Azure subscription permissions; it grants application platform administration only.

## 7. Invite and verify

In **Administration → Invite user**, enter a name, the person's exact Microsoft sign-in email, and a role. The email link expires after seven days. They must open it, sign in with the matching Microsoft account, and select **Accept invitation**. In a home, its owner opens **Members → Add member** and enters that same active email. Platform access alone does not grant home access.

Before storing private inventory, test with a second account:

- Anonymous `/api/state` cannot return inventory; unapproved sign-in cannot return inventory.
- The invited account can accept once. A different signed-in email cannot accept its link.
- A home member can access that home and its photos; a nonmember cannot.
- Members cannot see the owner's Activity log. Disabling a platform user or removing a member blocks later requests.
- Create an item, add a photo, move it, print a QR label, sign out, and scan the QR link. Sign in again to reach the location.

## Troubleshooting and operating the site

| Symptom | Check |
| --- | --- |
| "Approval required" | Correct Microsoft account and SWA user ID; bootstrap settings or invitation acceptance |
| API unavailable | Deployment run, managed API build, seven application settings, exact `APP_ORIGIN` |
| Invitation fails | Connected verified domain, sender address, connection string, Azure email usage/quotas |
| Cosmos free tier unavailable | Another free tier account in the subscription, unsupported capacity choice, or offer eligibility |
| Charges | Cost Management, Cosmos throughput/storage and email usage; budgets alert but do not cap |

Keep the deployment token, Cosmos key, and email connection string in their respective secret stores. Rotate a key or token if exposed. Review [security boundaries](../SECURITY.md) and the [user guide](USER_GUIDE.md).
