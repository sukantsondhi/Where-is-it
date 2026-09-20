
import { test, expect } from "@playwright/test";
for(const width of [320,390,768,1440]){
 test("layout at "+width+"px",async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto("/");
  await expect(page.getByRole("heading",{name:/Less “where is it/})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await page.screenshot({path:"test-results/home-"+width+".png",fullPage:true});
 });
}
test("create room, location, item, search, edit and persist",async({page})=>{
 await page.goto("/");
 await page.getByRole("button",{name:/Family Home/}).click();
 await page.getByRole("button",{name:"Add room",exact:true}).click();
 await page.getByLabel("Name",{exact:true}).fill("Test bedroom");await page.getByRole("button",{name:"Save",exact:true}).click();
 await page.getByRole("button",{name:/Test bedroom/}).click();
 await page.getByRole("button",{name:"Add storage",exact:true}).click();
 await page.getByLabel("Name",{exact:true}).fill("Top drawer");await page.getByRole("button",{name:"Save",exact:true}).click();
 await page.locator(".card-open").filter({hasText:"Top drawer"}).click();
 await page.getByRole("button",{name:"Add item",exact:true}).click();
 await page.getByLabel("Name",{exact:true}).fill("Blue test adapter");await page.getByRole("button",{name:"Save",exact:true}).click();
 await page.getByRole("button",{name:/Blue test adapter/}).click();
 await page.getByRole("button",{name:"Edit item",exact:true}).click();
 await page.getByLabel("Name",{exact:true}).fill("Updated adapter");await page.getByRole("button",{name:"Save",exact:true}).click();
 await page.reload();await page.getByRole("button",{name:/All items/}).click();
 await page.getByRole("textbox",{name:"Search inventory"}).fill("Updated adapter");
 await expect(page.getByRole("heading",{name:"Updated adapter",exact:true})).toBeVisible();
});
test("QR deep link opens exact location",async({page})=>{
 await page.goto("/?location=loc-desk");
 await expect(page.getByRole("heading",{name:"Desk drawers",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"QR label",exact:true}).click();
 await expect(page.locator("#qr-print svg")).toBeVisible();
});
test("shared home has no logs tab",async({page})=>{
 await page.goto("/");await page.getByRole("button",{name:/Parents' House/}).click();
 await expect(page.getByRole("tab",{name:"Activity log"})).toHaveCount(0);
});

test("mobile navigation, dark theme and keyboard dialog escape",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/");
 await page.getByRole("button",{name:"Open navigation"}).click();
 await page.getByRole("button",{name:/All items/}).click();
 await page.getByRole("textbox",{name:"Search inventory"}).fill("batteries");
 await expect(page.getByRole("heading",{name:"AA batteries"})).toBeVisible();
 await page.getByRole("button",{name:"Use dark theme"}).click();
 await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
 await page.getByRole("button",{name:/AA batteries/}).click();
 await expect(page.getByRole("dialog")).toBeVisible();await page.keyboard.press("Escape");
 await expect(page.getByRole("dialog")).toHaveCount(0);
});


test("search scopes include nested storage and exclude other rooms",async({page})=>{
 await page.goto("/");
 await page.getByRole("textbox",{name:"Search inventory"}).fill("adapter");
 await expect(page.getByRole("heading",{name:"USB-C to HDMI adapter",exact:true})).toBeVisible();
 await page.getByRole("button",{name:/Family Home/}).click();
 await page.getByRole("textbox",{name:"Search inventory"}).fill("receiver");
 await expect(page.getByRole("heading",{name:"Logitech USB receiver",exact:true})).toBeVisible();
 await page.getByRole("button",{name:/Bedroom.*storage locations/}).click();
 await page.getByRole("textbox",{name:"Search inventory"}).fill("receiver");
 await expect(page.getByRole("heading",{name:"No matching items.",exact:true})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Logitech USB receiver",exact:true})).toHaveCount(0);
 await page.getByRole("textbox",{name:"Search inventory"}).fill("glasses");
 await expect(page.getByRole("heading",{name:"Reading glasses",exact:true})).toBeVisible();
 await page.locator(".card-open").filter({hasText:"Desk drawers"}).click();
 await page.getByRole("textbox",{name:"Search inventory"}).fill("glasses");
 await expect(page.getByRole("heading",{name:"Reading glasses",exact:true})).toHaveCount(0);
 await page.getByRole("textbox",{name:"Search inventory"}).fill("adapter");
 await page.getByRole("button",{name:/USB-C to HDMI adapter/}).click();
 await expect(page.getByRole("dialog")).toBeVisible();
});

test("admin invites by email without SWA ID",async({page})=>{
 await page.goto("/");await page.getByRole("button",{name:"Administration",exact:true}).click();
 await page.getByRole("button",{name:"Invite user",exact:true}).click();
 await expect(page.getByLabel("SWA user ID")).toHaveCount(0);
 await page.getByLabel("Full name").fill("Test guest");
 await page.getByLabel("Email",{exact:true}).fill("guest@example.com");
 await page.getByRole("button",{name:"Send invitation",exact:true}).click();
 await expect(page.getByRole("status")).toContainText("No email was sent");
 await expect(page.locator(".person-row").filter({hasText:"guest@example.com"})).toContainText("invited");
});
