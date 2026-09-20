import { createHash } from "node:crypto";
import type { Container } from "@azure/cosmos";

type Counter = { id: string; homeId: string; kind: "rate"; window: number; count: number; _etag?: string };

// Cosmos ETags make the limit shared by every managed Functions instance.
export async function limitRequest(container: Container, userId: string, scope: string, maximum: number, windowMs: number, now = Date.now()) {
 const homeId = "rate-" + createHash("sha256").update(userId).digest("hex");
 const id = "rate-" + scope, window = Math.floor(now / windowMs);
 for (let attempt = 0; attempt < 5; attempt++) {
  let current: Counter | undefined;
  try { current = (await container.item(id, homeId).read<Counter>()).resource; }
  catch (error) { if ((error as {code?:number}).code !== 404) throw error; }
  if (current?.window === window && current.count >= maximum) {
   throw Object.assign(new Error("Too many requests. Please try again later."), {
    status: 429, retryAfter: Math.max(1, Math.ceil(((window + 1) * windowMs - now) / 1000))
   });
  }
  const next: Counter = { id, homeId, kind: "rate", window, count: current?.window === window ? current.count + 1 : 1 };
  try {
   if (current) await container.item(id, homeId).replace(next, { accessCondition: { type: "IfMatch", condition: current._etag! } });
   else await container.items.create(next);
   return;
  } catch (error) {
   if (![409, 412].includes((error as {code?:number}).code ?? 0)) throw error;
  }
 }
 throw Object.assign(new Error("Request limit is busy. Please try again."), { status: 503 });
}
