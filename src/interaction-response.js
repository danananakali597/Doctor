// Acknowledge before network work; handlers may share the same interaction.
export async function deferPrivate(i) {
  if (!i.deferred && !i.replied) await i.deferReply({flags:64});
}
export async function respondPrivate(i, payload) {
  if (i.deferred || i.replied) return i.editReply(payload);
  return i.reply({...payload, flags:64});
}
export async function checkComponentAccess(i, member, name) {
  const {commandAccess}=await import('./command-policy.js');
  const reason=commandAccess(i.guildId,name,member,i.channel);
  if(reason)throw Error(reason);
}
