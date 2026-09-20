import { createHash, randomBytes } from "node:crypto";
import { EmailClient } from "@azure/communication-email";
import type { Person } from "../../src/types";

export type UserDoc = Person & { swaId?: string; tokenHash?: string; expiresAt?: number; _etag?: string };
export const emailId = (email: string) => "email-" + createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function newInvitation() {
 const token = randomBytes(32).toString("hex");
 return { token, tokenHash: hashToken(token), expiresAt: Date.now() + 7 * 86400000 };
}
export function canAccept(user: UserDoc, token: unknown, email: string) {
 return user.status === "invited" && typeof token === "string" && /^[a-f0-9]{64}$/.test(token)
  && user.tokenHash === hashToken(token) && (user.expiresAt || 0) > Date.now()
  && user.email === email.trim().toLowerCase();
}
export function publicPerson(user: Person): Person {
 const { id, name, email, avatar, platformRole, status } = user;
 return { id, name, email, avatar, platformRole, status };
}
export function requireEmailConfiguration() {
 if ((!process.env.ACS_EMAIL_CONNECTION_STRING && !process.env.RESEND_API_KEY) || !process.env.INVITE_FROM || !process.env.APP_ORIGIN) {
  throw Object.assign(new Error("Configure ACS_EMAIL_CONNECTION_STRING, INVITE_FROM and APP_ORIGIN before sending invitations."), { status: 400 });
 }
}
export async function sendInvitation(email: string, token: string) {
 requireEmailConfiguration();
 const link = new URL("/", process.env.APP_ORIGIN!); link.hash = "invite=" + token + "&email=" + encodeURIComponent(email);
 const subject = "Your invitation to Where is it";
 const text = `You have been invited to Where is it. Open this link and sign in with the Microsoft account for ${email}:\n\n${link}\n\nThis invitation expires in 7 days. If you did not expect it, you can ignore it.`;
 if (process.env.ACS_EMAIL_CONNECTION_STRING) {
  try {
   const client = new EmailClient(process.env.ACS_EMAIL_CONNECTION_STRING, { retryOptions: { maxRetries: 1 } });
   const abortSignal = AbortSignal.timeout(25000);
   const poller = await client.beginSend({ senderAddress: process.env.INVITE_FROM!, content: { subject, plainText: text }, recipients: { to: [{ address: email }] } }, { abortSignal });
   const result = await poller.pollUntilDone({ abortSignal });
   if (result.status !== "Succeeded") throw new Error("Email send failed.");
   return;
  } catch {
   throw Object.assign(new Error("Invitation email could not be confirmed. Check the Azure email service configuration and retry if the email does not arrive."), { status: 400 });
  }
 }
 const response = await fetch("https://api.resend.com/emails", {
  method: "POST", signal: AbortSignal.timeout(15000),
  headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ from: process.env.INVITE_FROM, to: [email], subject, text })
 });
 if (!response.ok) throw Object.assign(new Error("Invitation email could not be sent. Check the sender configuration and retry the invitation."), { status: 400 });
}
