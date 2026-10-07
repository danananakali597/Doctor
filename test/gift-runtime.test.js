import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {integrateGiftWeb,integrateGiftDashboard} from '../src/gift-runtime.js';
test('hosting-restored web source receives protected routes once without changing existing routes',()=>{
 const source="import express from 'express';\napp.get('/existing',auth,existing);\napp.get('/api/me',auth,(req,res)=>res.json({user:req.session.user,csrf:req.session.csrf}));\napp.use(express.static('public'));";
 const patched=integrateGiftWeb(source);assert.equal(integrateGiftWeb(patched),patched);
 assert.ok(patched.includes("app.get('/existing',auth,existing);"));assert.ok(patched.includes('operator:!!'));
 assert.ok(patched.indexOf('attachGiftRoutes(app,')<patched.indexOf('app.use(express.static('));
});
test('hosting-restored dashboard receives private gift controls once and retains other features',()=>{
 const source="import {translations} from './i18n.js';\nfunction cinema(){return 'existing';}\nfunction plans(root){root.append('plans');}";
 const patched=integrateGiftDashboard(source);assert.equal(integrateGiftDashboard(patched),patched);
 assert.ok(patched.includes("function cinema(){return 'existing';}"));assert.ok(patched.includes('operator:me.operator'));assert.ok(patched.includes('of giftRows)'));
 const actual=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');assert.equal(integrateGiftDashboard(actual),actual);
});
