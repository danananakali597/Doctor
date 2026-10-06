import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Apply the ticket integration after the existing hosting startup installers.
// Those installers may restore an older community handler before index starts.
export function integrateTicketJourney(source){
 const importLine="import {handleTicketInteraction as vexTicketJourneyInteraction,publishConfiguredTicketPanel as vexTicketJourneyPublish} from './tickets.js';";
 if(!source.includes(importLine))source=importLine+'\n'+source;
 const interaction=/export\s+async\s+function\s+communityInteraction\s*\(\s*(\w+)\s*\)\s*\{/;
 const publish=/export\s+async\s+function\s+publishPanel\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s*\{/;
 if(!interaction.test(source)||!publish.test(source))throw Error('Ticket Journey could not locate the community integration points');
 if(!source.includes('if(await vexTicketJourneyInteraction('))source=source.replace(interaction,(match,i)=>match+`\n if(await vexTicketJourneyInteraction(${i}))return true;`);
 if(!source.includes("return vexTicketJourneyPublish("))source=source.replace(publish,(match,g,kind)=>match+`\n if(${kind}==='tickets')return vexTicketJourneyPublish(${g});`);
 return source;
}
export function installTicketJourney(){
 const filename=path.join(path.dirname(fileURLToPath(import.meta.url)),'community.js');
 const before=fs.readFileSync(filename,'utf8'),after=integrateTicketJourney(before);
 if(before!==after)fs.writeFileSync(filename,after);
 console.log('VEX Ticket Journey integration installed after hosting startup overrides.');
}
