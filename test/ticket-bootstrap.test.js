import test from 'node:test';
import assert from 'node:assert/strict';
import {integrateTicketJourney} from '../src/ticket-bootstrap.js';
test('hosting-installed legacy community handlers route tickets before legacy handlers, preserving other modules',()=>{
 const legacy=`import {welcomePayload} from './welcome.js';
export async function publishPanel(g,kind){const cfg=community(g.id)[kind];if(kind==='selfroles')return roles(cfg);return oldTicketPanel(cfg);}
export async function communityInteraction(i){if(i.isButton())return legacyButtons(i);return welcomePayload(i);}
export function attachCommunity(client){attachWelcome(client);}`;
 const patched=integrateTicketJourney(legacy);
 assert.ok(patched.indexOf('if(await vexTicketJourneyInteraction(i))')<patched.indexOf('if(i.isButton())'));
 assert.ok(patched.indexOf("if(kind==='tickets')return vexTicketJourneyPublish(g);")<patched.indexOf('const cfg='));
 for(const original of ["if(kind==='selfroles')return roles(cfg);",'return welcomePayload(i);','attachWelcome(client);'])assert.ok(patched.includes(original));
 assert.equal(integrateTicketJourney(patched),patched);
 assert.throws(()=>integrateTicketJourney('export const unknown=true;'),/could not locate/);
});
