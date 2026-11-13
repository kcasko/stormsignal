import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const b=await chromium.launch({headless:true});
try {
 const p=await b.newPage({viewport:{width:1280,height:780},deviceScaleFactor:1});
 await p.goto(pathToFileURL(resolve("docs/architecture-submission.svg")).href);
 await p.screenshot({path:resolve("docs/screenshots/12-architecture-submission.png"),animations:"disabled"});
 console.log("architecture image rendered");
}finally{await b.close();}
