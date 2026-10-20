import * as pdfjs from '/private/tmp/claude-501/-Users-c0mrad3-Documents-IT-PORTAL-CLAUDE/0d3a9b4c-8719-4f81-9782-76e40a620cda/scratchpad/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const P = require('/private/tmp/claude-501/-Users-c0mrad3-Documents-IT-PORTAL-CLAUDE/0d3a9b4c-8719-4f81-9782-76e40a620cda/scratchpad/demo/parser.js');
export async function extract(buf){
  const doc = await pdfjs.getDocument({data:new Uint8Array(buf)}).promise; const pages=[];
  for (let p=1;p<=doc.numPages;p++){ const page=await doc.getPage(p); const vp=page.getViewport({scale:1}); const tc=await page.getTextContent();
    pages.push({width:vp.width,height:vp.height,items:tc.items.map(it=>{const fs=Math.hypot(it.transform[2],it.transform[3])||it.height; return {str:it.str,x:it.transform[4],y:vp.height-it.transform[5]-fs*0.8,w:it.width,h:fs};})}); }
  return pages;
}
const r = P.parse(await extract(fs.readFileSync(process.argv[2])));
console.log(JSON.stringify(r.meta));
for (const [k,v] of Object.entries(r.fields)) console.log(k.padEnd(20), JSON.stringify(v.value), v.box?('p'+v.box.page):'-');
console.log('labels',r.labelsSeen,'unknown',r.unknownLabels);
