import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {commandsUI} from '../public/commands-ui.js';
const window=new Window();globalThis.document=window.document;
const h=(tag,props={},...children)=>{const el=document.createElement(tag);for(const[k,v]of Object.entries(props)){if(k.startsWith('on'))el.addEventListener(k.slice(2).toLowerCase(),v);else if(k==='class')el.className=v;else if(['checked','disabled','open'].includes(k))el[k]=v;else el.setAttribute(k,v);}for(const child of children.flat())if(child!==null&&child!==undefined)el.append(child instanceof window.Node?child:document.createTextNode(String(child)));return el;};
function fixture(editable=true){const root=document.createElement('section');document.body.append(root);const patch={};const data={commands:[{name:'ban',description:'Ban a member',moderator:true},{name:'rank',description:'Your rank'}],settings:{commandRules:{}},permissions:editable?['moderation']:[],roles:[{id:'123456789012345678',name:'First'},{id:'223456789012345678',name:'Second'}],channels:[]};commandsUI({h,raw:v=>document.createTextNode(String(v)),data,patch,mark:()=>{}})(root);return {root,patch};}
test('picking several roles preserves earlier picks and updates the count',()=>{
 const {root,patch}=fixture();const inputs=root.querySelectorAll('.command-filter input');for(const i of [0,1]){inputs[i].checked=true;inputs[i].dispatchEvent(new window.Event('change'));}
 assert.deepEqual(patch.commandRules.ban.allowedRoles,['123456789012345678','223456789012345678']);assert.equal(root.querySelector('.command-filter summary .tag').textContent,'2');
 inputs[0].checked=false;inputs[0].dispatchEvent(new window.Event('change'));assert.deepEqual(patch.commandRules.ban.allowedRoles,['223456789012345678']);root.remove();
});
test('command search retains focus and cursor when each input rebuilds the editor',()=>{
 const {root}=fixture();let input=root.querySelector('input[type=search]');input.focus();input.value='ban';input.setSelectionRange(3,3);input.dispatchEvent(new window.Event('input'));
 input=root.querySelector('input[type=search]');assert.equal(document.activeElement,input);assert.equal(input.selectionStart,3);assert.equal(root.querySelectorAll('.command-item').length,1);root.remove();
});
test('read-only command editors cannot stage policy changes',()=>{
 const {root,patch}=fixture(false);for(const input of root.querySelectorAll('input[type=checkbox]'))assert.equal(input.disabled,true);
 const pick=root.querySelector('.command-filter input');pick.checked=true;pick.dispatchEvent(new window.Event('change'));assert.deepEqual(patch,{});root.remove();
});
test.after(()=>window.happyDOM.abort());
