import { chromium, devices } from "@playwright/test";
import { resolve } from "node:path";
const base="https://d3p9tcn7282g7r.cloudfront.net";
const browser=await chromium.launch({headless:true});
try {
for(const [kind,contextOptions] of [
  ["desktop",{viewport:{width:1440,height:900},deviceScaleFactor:1,colorScheme:"light" as const}],
  ["mobile",{...devices["Pixel 7"],colorScheme:"light" as const}]
] as const){
 const ctx=await browser.newContext(contextOptions);
 const page=await ctx.newPage();
 page.on("pageerror",err=>console.error("PAGE ERROR",err.message));
 await page.addInitScript(()=>{localStorage.setItem("stormsignal-location","kalamazoo");});
 await page.goto(base+"/#whatif",{waitUntil:"domcontentloaded"});
 await page.getByRole("heading",{name:"Weather along a trip"}).waitFor();
 await page.getByRole("combobox",{name:"Planned departure"}).selectOption("3");
 await page.getByRole("button",{name:"Check route"}).click();
 await page.getByTestId("interactive-route-map").waitFor({timeout:45000});
 await page.locator(".leaflet-tile-loaded").first().waitFor({timeout:15000});
 await page.waitForTimeout(500);
 const name=kind==="desktop"?"10-route-live":"11-route-live-mobile";
 await page.locator(".route-plan").screenshot({path:resolve("docs/screenshots",name+".png"),timeout:25000,animations:"disabled"});
 console.log(name, "rendered",await page.locator(".leaflet-tile-loaded").count(),"map tiles");
 await ctx.close();
}
}finally{await browser.close();}
