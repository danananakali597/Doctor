# VEX Command Core 4.0

`/vex` opens a private, native Discord control center. `/help`, `/commands` and `/security` share the same interface. Select a section to edit the existing message. English, Sorani Kurdish, Arabic and Turkish navigation is available through `/vex language`; existing command names remain unchanged. Status comes from the running client, saved server settings and current entitlement. No artificial security score or AI-online claim is shown.

The center groups Community, Security, Moderation, Logs, Support, Voice, AI and Cinema/Games. It discovers AI and game commands from the actual registration array, so the integration preserves the installed modules rather than claiming a new AI provider or game was implemented.

## Moderation

`/warn`, `/timeout`, `/untimeout`, `/kick`, `/ban`, `/unban`, `/clear` and `/moderate` create a two-minute private review. The moderation section also provides a member selector, action selector and reason form. Confirmation checks fresh Discord membership, the current command role/channel policy, module enablement, current actor and bot permissions, target hierarchy, and timeout bounds. A synchronous session claim prevents repeated clicks from executing twice. The result has an actual case number, actor, target/reason and timestamp. Authorized moderators can open the case in the same message.

Server lockdown also requires review and current ownership. Enabling still requires Ultimate and configured channels. Restoring remains possible after the entitlement expires. The existing operation restores saved permission bits and reports individual channel failures.

Review sessions are memory-only, bound to the invoker, guild and channel. Restarting invalidates pending reviews, without performing an action. Discord side effects and the SQLite case insert are not one atomic operation: an external API failure or database failure can leave an ambiguous outcome. Failed sessions cannot retry the side effect; moderators should inspect Discord and the casebook before issuing a new command. Kick and message deletion have no automated undo.

## Dashboard

Navigation has explicit Security, Community, Voice, Support/Moderation and Logs groups. Installed AI Security stays under Security; installed AI Chat and Cinema stay under AI/Entertainment. Existing module routes are retained. The command directory displays the actual registration array, each workflow, its settings destination and command access editor. Module pages retain their per-command controls. Command editing requires the existing moderation editing scope; the server continues to enforce it.

Core links open the corresponding dashboard section after Discord login and server selection. Unsupported routes fall back to Overview. Search focus is retained while filtering commands. Numeric zero values remain visible. New navigation and directory labels are translated in the four dashboard languages; existing module text keeps its current translations. The Discord navigation is localized; detailed diagnostic text remains English.

## Hosting integration

The current production start command installs additional Cinema, Welcome, AI and Security sources from service-side configuration before importing `src/index.js`. This release preserves that start command. `installCommandRuntime()` runs after those installers and adds only the core schema, compatible response acknowledgement, organized navigation, deep links and role-menu policy checking. It does not delete service variables or replace those installed modules. The runtime router dispatches only the core-owned interactions and passes other commands and components to their existing listeners.

The repository now contains reviewable source, tests and the lockfile directly. The previous ZIP-only deployment arrangement is retired. The production volume, secrets and single replica remain managed by the existing service.

## Verification

Run `npm ci`, `npm test`, `npm run check`. Automated tests cover native payload limits, four-language controls, early acknowledgement, previews without side effects, repeated confirmations, permission/policy/hierarchy changes, tenant/session isolation, expiry/cancellation, wizard forms, owner-only lockdown review, existing ticket/role/log flows and runtime compatibility transforms. They simulate Discord API operations; they do not ban real members or certify every service-side installer. Live deployment readiness and public asset routing require separate verification.

This release does not implement the proposed BLACKOUT multiplayer game, connect billing, or promise that every runtime module is free of defects. Those features must be tested against their actual configured services and Discord client.
