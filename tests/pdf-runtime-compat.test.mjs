import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const vendor=new URL('../public/vendor/pdfjs/',import.meta.url);
const legacy=new URL('legacy-6.4.299/',vendor);
const missing=`Promise.withResolvers=undefined;Promise.try=undefined;Uint8Array.fromBase64=undefined;Uint8Array.prototype.toBase64=undefined;`;
function run(code){const r=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:15000});assert.equal(r.status,0,r.stderr+r.stdout);return JSON.parse(r.stdout.trim().split('\n').at(-1));}

test('the old modern PDF runtime reproduces a missing withResolvers failure',()=>{
  const result=run(`${missing} const m=await import(${JSON.stringify(new URL('pdf.mjs',vendor).href)});try{await m.getDocument({data:new Uint8Array()}).promise;process.exit(2);}catch(e){console.log(JSON.stringify({name:e.name,message:e.message}));}`);
  assert.equal(result.name,'TypeError');assert.match(result.message,/withResolvers/);
});

test('legacy display and worker bootstrap restore missing APIs and parse a PDF',()=>{
  const parts=['%PDF-1.4\n'];const offsets=[0];
  for(const [i,body] of ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>'].entries()){
    offsets.push(parts.join('').length);parts.push(`${i+1} 0 obj\n${body}\nendobj\n`);
  }
  const xref=parts.join('').length;
  parts.push(`xref\n0 4\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const result=run(`${missing} await import(${JSON.stringify(new URL('pdf.compat.mjs',legacy).href)});const m=await import(${JSON.stringify(new URL('pdf.mjs',legacy).href)});m.GlobalWorkerOptions.workerSrc=${JSON.stringify(new URL('pdf.worker.bootstrap.mjs',legacy).href)};const task=m.getDocument({data:new TextEncoder().encode(${JSON.stringify(parts.join(''))})});const d=await task.promise,p=await d.getPage(1);console.log(JSON.stringify({version:m.version,pages:d.numPages,view:p.view,withResolvers:typeof Promise.withResolvers,promiseTry:typeof Promise.try,fromBase64:typeof Uint8Array.fromBase64,toBase64:typeof Uint8Array.prototype.toBase64}));await task.destroy();`);
  assert.deepEqual(result,{version:'6.4.299',pages:1,view:[0,0,612,792],withResolvers:'function',promiseTry:'function',fromBase64:'function',toBase64:'function'});
});

test('worker bootstrap installs its own compatibility function in a fresh realm',()=>{
  const result=run(`${missing} const w=await import(${JSON.stringify(new URL('pdf.worker.bootstrap.mjs',legacy).href)});const cap=Promise.withResolvers();cap.resolve(7);console.log(JSON.stringify({handler:typeof w.WorkerMessageHandler,resolved:await cap.promise,promiseTry:typeof Promise.try}));`);
  assert.deepEqual(result,{handler:'function',resolved:7,promiseTry:'function'});
});

test('mobile fallback raster dimensions do not change PDF CSS geometry or the native source link',()=>{
  const source=readFileSync(new URL('../src/pdf-viewer.tsx',import.meta.url),'utf8');
  assert.ok(source.includes("cv.style.width=vp.width+'px'"));
  assert.ok(source.includes('const visible=renderable?visiblePageRange'));
  assert.ok(source.includes('pdfLibrary=undefined;pdfModuleAttempt++'));
  assert.ok(source.includes('await renderSettled.current.catch'));
  assert.ok(source.includes('cv.width=0;cv.height=0'));
  assert.ok(source.includes('href={assetUrl(id)}'));
});
