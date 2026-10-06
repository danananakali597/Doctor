import {SlashCommandBuilder} from 'discord.js';
export const vexCommand = new SlashCommandBuilder().setName('vex')
  .setDescription('Open your private VEX command center').setDMPermission(false)
  .addStringOption(o=>o.setName('language').setDescription('Interface language').addChoices(
    {name:'English',value:'en'},{name:'کوردی',value:'ckb'},
    {name:'العربية',value:'ar'},{name:'Türkçe',value:'tr'})).toJSON();
