
import fs from "node:fs";
const config=JSON.parse(fs.readFileSync("staticwebapp.config.json","utf8"));
// Use SWA's built-in Microsoft provider, which is available on the Free plan.
// Access to inventory still requires an active, explicitly approved API user.
if(config.auth)throw new Error("Custom authentication requires paid hosting. Use the built-in Microsoft provider.");
fs.writeFileSync("dist/staticwebapp.config.json",JSON.stringify(config,null,2));
