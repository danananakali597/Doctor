import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {giftKeysUI} from '../public/gift-keys.js';
const window=new Window();globalThis.document=window.document;
const h=(tag,props={},...children)=>{const el=document.createElement(tag);for(const[k,v]of Object.entries(props)){if(k.startsWith('on'))el.addEventListener(k.slice(2).toLowerCase(),v);else if(k==='value')el.value=v;else el.setAttribute(k,v);}for(const c of children.flat())if(c!=null)el.append(typeof c==='object'?c:document.createTextNode(String(c)));return el;};
const button=(text,action)=>h('button',{onClick:action},text);
test('ordinary dashboard users see only redemption and never request private key metadata',()=>{
 const root=h('div');document.body.append(root);let requests=0;
 giftKeysUI(root,{h,button,api:()=>{requests++;},toast:()=>{},refresh:()=>{},guildId:'guild',operator:false,date:String});
 assert.ok(root.textContent.includes('Activate a gift key'));assert.equal(root.textContent.includes('Private gift keys'),false);assert.equal(root.textContent.includes('Create one-month key'),false);assert.equal(requests,0);root.remove();
});
test('operator sees private controls and minting displays the new secret once',async()=>{
 const root=h('div');document.body.append(root);const requests=[];
 const key='VEX-'+'A'.repeat(48);
 const api=async(url,options={})=>{requests.push({url,options});return options.method==='POST'?{plan:'plus',key}:{keys:[]};};
 giftKeysUI(root,{h,button,api,toast:()=>{},refresh:()=>{},guildId:'guild',operator:true,date:String});
 await new Promise(resolve=>setImmediate(resolve));assert.ok(root.textContent.includes('Private gift keys'));
 root.querySelectorAll('button').values().find(b=>b.textContent==='Create one-month key').click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(root.querySelector('[aria-label="New gift key"]').value,key);assert.ok(requests.some(r=>r.options.method==='POST'&&JSON.parse(r.options.body).plan==='plus'));
 root.remove();
});
test.after(()=>{window.close();delete globalThis.document;});
test('private owner page displays minting without the public redemption panel',()=>{const root=h('div');document.body.append(root);giftKeysUI(root,{h,button,api:async()=>({keys:[]}),toast:()=>{},refresh:()=>{},guildId:'guild',operator:true,date:String,redeemEnabled:false});assert.ok(root.textContent.includes('Private gift keys'));assert.equal(root.textContent.includes('Activate a gift key'),false);root.remove();});
