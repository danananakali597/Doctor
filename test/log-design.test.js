import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLogEmbed,logSeverity} from '../src/log-design.js';
import {logDefaults,mergeLogs} from '../src/log-catalog.js';
test('ordinary moderation warns; detected destructive bursts and scams escalate',()=>{
 assert.equal(logSeverity('message_edited'),'normal');
 assert.equal(logSeverity('member_banned'),'danger');
 assert.equal(logSeverity('security_incident'),'danger');
 assert.equal(logSeverity('join_protection',{rules:'age, raid'}),'danger');
 assert.equal(logSeverity('message_violation',{rules:'spam'}),'warning');
 assert.equal(logSeverity('message_violation',{rules:'scam'}),'danger');
 const rules=mergeLogs(logDefaults(),{member_banned:{enabled:true,color:'#000000'}});
 assert.equal(rules.member_banned.color,'#e74c3c');assert.equal(rules.member_banned.enabled,true);
});
test('embeds use readable mentions without guessing target type and stay within limits',()=>{
 const embed=buildLogEmbed({},'security_incident',{actor:'123456789012345678',channel:'123456789012345679',target:'123456789012345680',...Object.fromEntries(Array.from({length:20},(_,i)=>['long_'+i,'x'.repeat(1000)]))});
 assert.equal(embed.color,0xe74c3c);
 assert.equal(embed.fields[0].value,'<@123456789012345678>');
 assert.equal(embed.fields[1].value,'<#123456789012345679>');
 assert.equal(embed.fields[2].value,'123456789012345680');
 assert.ok(embed.fields.reduce((n,f)=>n+f.name.length+f.value.length,embed.title.length+embed.footer.text.length)<6000);
 assert.ok(embed.fields.length<=25);
});
test('reference embeds keep deleted fields stacked and ban fields paired with the target avatar',()=>{
 const deleted=buildLogEmbed({},'message_deleted',{author:'123456789012345678',channel:'123456789012345679',deleted_by:'123456789012345680',content:'Hello everyone!',message:'internal-id'});
 assert.deepEqual(deleted.fields.map(f=>[f.name,f.inline]),[['Author',false],['Channel',false],['Deleted by',false],['Message',false]]);
 assert.equal(deleted.fields[3].value,'```\nHello everyone!\n```');
 assert.equal(deleted.footer.text,'VEX • Message Logs');
 const guild={members:{cache:new Map([['123456789012345678',{user:{displayAvatarURL:()=> 'https://cdn.discordapp.com/target.png'}}]])}};
 const banned=buildLogEmbed(guild,'member_banned',{target:'123456789012345678',actor:'123456789012345680',reason:'Repeated spam',audit_entry:'123'});
 assert.deepEqual(banned.fields.map(f=>[f.name,f.inline]),[['Member',true],['Moderator',true],['Reason',false]]);
 assert.equal(banned.color,0xe74c3c);assert.equal(banned.thumbnail.url,'https://cdn.discordapp.com/target.png');assert.equal(banned.footer.text,'VEX • Moderation');
});
test('small actor portrait and name are separate from subject and unknown actors stay explicit',()=>{
 const guild={members:{cache:new Map()},client:{users:{cache:new Map([['123456789012345678',{username:'Moderator',displayAvatarURL:()=> 'https://cdn.discordapp.com/embed/avatars/0.png'}]])}}};
 const card=buildLogEmbed(guild,'member_banned',{actor:'123456789012345678',target:'223456789012345678'});
 assert.equal(card.author.name,'Moderator');assert.ok(card.author.icon_url);assert.ok(card.description.includes('Moderator'));
 assert.ok(buildLogEmbed(guild,'role_updated',{target:'223456789012345678'}).description.includes('Actor not confirmed'));
});
