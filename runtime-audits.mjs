// Keep legacy audit imports relative to the repository root, matching the old
// inline startup command. The sealed audit content stays execution-only.
export async function runCompatibilityAudits(){
 for(const key of ['VEX_AI_STARTUP_AUDIT_SOURCE','VEX_AI_PROVIDER_CONNECTION_AUDIT_SOURCE','VEX_SECURITY_SUITE_STARTUP_AUDIT_SOURCE','VEX_DASHBOARD_CONNECTION_AUDIT_SOURCE','VEX_SECURITY_ADVANCED_AUDIT_SOURCE'])if(process.env[key]){
  const Run=Object.getPrototypeOf(async function(){}).constructor;await new Run(process.env[key])();
 }
}
