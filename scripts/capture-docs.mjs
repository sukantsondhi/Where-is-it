import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const out = "docs/screenshots";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const base = process.env.DOCS_BASE_URL || "http://127.0.0.1:5173";
  const shot = async name => {
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  };
  await page.goto(base);
  await page.getByRole("heading", { name: /Less.*where is it/i }).waitFor();
  await shot("dashboard");
  await page.getByRole("button", { name: /Family Home/ }).click();
  await shot("home");
  await page.getByRole("button", { name: /Bedroom.*storage locations/ }).click();
  await page.locator(".card-open").filter({ hasText: "Desk drawers" }).click();
  await shot("location");
  await page.getByRole("button", { name: /USB-C to HDMI adapter/ }).click();
  await shot("item");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "QR label" }).click();
  await shot("qr-label");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: /All items/ }).click();
  await shot("all-items");
  await page.getByRole("button", { name: "Administration" }).click();
  await page.locator(".person-row").first().waitFor();
  await shot("administration");
  await page.getByRole("button", { name: /My homes/ }).click();
  await page.getByRole("button", { name: /Family Home/ }).click();
  await page.getByRole("tab", { name: "Members" }).click();
  await shot("members");
  await page.getByRole("button", { name: "Preferences" }).click();
  await shot("preferences");
} finally {
  await browser.close();
}
