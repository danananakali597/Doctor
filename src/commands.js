import {logsCommand} from './log-command-spec.js';
import {vexCommand} from './command-spec.js';
import {communityCommands} from './community-commands.js';
import {SlashCommandBuilder,PermissionFlagsBits as P} from 'discord.js';
import {extraCommands} from './extra-commands.js';
export const commands=[new SlashCommandBuilder().setName('help').setDescription('Explore VEX commands and protection levels'),new SlashCommandBuilder().setName('security').setDescription('VEX security status and dashboard').setDefaultMemberPermissions(P.ManageGuild),new SlashCommandBuilder().setName('verify').setDescription('Approve a quarantined member').setDefaultMemberPermissions(P.ModerateMembers).addUserOption(x=>x.setName('member').setDescription('Member to approve').setRequired(true)),new SlashCommandBuilder().setName('scan').setDescription('Run the VEX security scanner').setDefaultMemberPermissions(P.Administrator),new SlashCommandBuilder().setName('lockdown').setDescription('Freeze or restore the configured channels').setDefaultMemberPermissions(P.Administrator).addBooleanOption(x=>x.setName('enabled').setDescription('Enable lockdown').setRequired(true))].map(c=>c.toJSON()).concat(communityCommands,extraCommands);

if(!commands.some(c=>c.name==='vex'))commands.push(vexCommand);

for(const c of commands){c.contexts=[0];c.dm_permission=false;}

if(!commands.some(c=>c.name==='logs'))commands.push(logsCommand);
