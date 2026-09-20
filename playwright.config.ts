
import { defineConfig } from "@playwright/test";
const baseURL=process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173";
export default defineConfig({
 testDir:"./tests/browser",timeout:30000,use:{baseURL,screenshot:"only-on-failure",...(process.env.CHROME_PATH?{launchOptions:{executablePath:process.env.CHROME_PATH}}:{})},
 reporter:[["list"],["html",{open:"never"}]],
 webServer:process.env.PLAYWRIGHT_BASE_URL?undefined:{command:"npm run dev -- --host 127.0.0.1",url:baseURL,reuseExistingServer:!process.env.CI}
});
