import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {installProductRuntime} from '../src/product-runtime.js';
import {installExperienceRuntime} from '../src/experience-runtime.js';
// Exercise exactly the integration installed by index after Railway's legacy patches,
// then restore source templates needed by those legacy patches on the next boot.
const paths=['src/web.js','public/app.js','src/community-catalog.js','src/community.js','public/community-ui.js','src/welcome.js','src/commands.js','src/db.js','src/catalog.js','src/notifications.js','src/logs.js','src/operations.js'];
const originals=new Map(paths.map(p=>[p,fs.readFileSync(p)]));
try{installExperienceRuntime();installProductRuntime();execFileSync(process.execPath,['--test',...fs.readdirSync('test').filter(p=>p.endsWith('.test.js')).map(p=>'test/'+p)],{stdio:'inherit'});}finally{for(const [p,s]of originals)fs.writeFileSync(p,s);}
