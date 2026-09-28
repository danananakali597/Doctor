# VEX Community OS 3.0

## Community modules 3.4.1

Utility and its slash commands were removed from the dashboard and Discord registration at the server owner’s request. `/help` and `/commands` remain for discovery. Previously stored utility data is retained in the server database but no longer controls an active module.

## Command center 3.4

The dashboard now places per-command on/off switches and allowed/blocked roles and channels inside the corresponding module, including Leveling, Moderation and Voice. Restrictions are enforced before each slash command runs, alongside Discord permissions; help and command discovery remain available. A blocked role wins over an allowed role. History records changes and supports owner-confirmed restoration. These settings are isolated per server. Discord slash commands do not create invocation messages, so ProBot prefix aliases and deletion of invocation messages do not map to this implementation.

### Previous command release 3.3

VEX registers the remaining Discord slash commands. `/commands` opens a private, button-driven guide for Community, Voice, Moderation and Protection. `/help` links to the guide and the dashboard. Command replies use branded embeds and protect against unintended mentions.

Community tools include `/top`, `/setxp`, `/setlevel`, `/resetxp`, `/colors`, `/color`, `/starboard` and `/vip`. Color choices come only from safe, configured self-assignable color roles; VEX does not create elevated roles. XP adjustments do not automatically alter reward roles. 

New moderation and voice commands include `/warn`, `/warnings`, `/warn_remove`, `/timeout`, `/untimeout`, `/kick`, `/ban`, `/unban`, `/clear`, `/slowmode`, `/lock`, `/unlock`, `/moveme`, `/move`, `/vkick`, `/setnick` and `/role`. They check current Discord permissions and relevant role/channel restrictions. VEX channel unlock restores the previous public message bit, and refuses to overwrite a change made since the lock. Warning retractions remain in the casebook for audit. Replies are private to the invoker unless an existing module explicitly publishes to a channel.

ProBot also offers features such as an external URL shortener and a separate global economy. VEX does not claim those features. Slash commands may take time to appear after a global Discord registration update. Dashboard security, community and logs controls remain available as before.

Discord bot with community, moderation and security controls. The deployable source is bundled in `KurdBot.zip` for the Railway Dockerfile. The dashboard has grouped navigation, tier filters and per-module controls in English, Arabic, Sorani and Turkish.

## Plans

Basic: message spam/links/invites/mentions/words/caps and length filters, logs, join/leave monitoring.
Plus: join-burst detection, manual verification, account-age checks, timed quarantine, anti-bot, domain/URL heuristics, voice hopping protection, audit logs, trust lists.
Ultimate: audit-based Anti-Nuke, mass ban/kick detection, channel/role/webhook monitoring, permission escalation response, protected resources, lockdown, scanner/score, reports/timeline, structure backup/restore, tamper/owner alerts, repeated-incident rules.

Displayed $5/$10 monthly per-server prices are proposals. Billing is NOT connected. Basic is the default. Only the Discord application owner can grant seven-day test access in Plans. Entitlements and expiry are enforced server-side for API writes and events.

## Setup

Node 24, `npm ci`, configure `.env.example`, `npm start`. Enable Server Members and Message Content intents. OAuth redirect is `PUBLIC_URL/auth/callback`. Use HTTPS outside localhost.

Railway: mount a persistent volume at `/app/data` BEFORE public use. SQLite holds settings, incidents, sessions, entitlements, quarantines and backups. Without a volume these are lost on container replacement. One replica only. Healthcheck `/health` succeeds when Discord is ready.

The invite requests explicit permissions, not Administrator. Place the bot's role above the roles it should manage. Missing permissions and hierarchy failures are reported.

## Authorization

Every guild request checks fresh Discord membership and Manage Server permission. Configuration changes additionally require Administrator. Trust/excluded roles, protected resources, backup and lockdown are guild-owner-only. Quarantine approval requires Moderate Members and a higher moderator role. Trial grants require Discord application ownership. Writes require an exact origin and CSRF token. OAuth state is bound to the initiating browser. Secrets never go to the frontend.

## Limits and operation

New modules are OFF except logs and join/leave monitoring. Responses default to log only; granting a trial does not activate punitive rules.

- Anti-Nuke reacts after audit events arrive; cannot guarantee prevention, override the owner or act above the bot role. It can remove manageable dangerous actor roles. Permission Guard also attempts to undo newly added dangerous permissions/role assignments.
- Verification uses a finite Discord timeout with moderator approval, NOT CAPTCHA. Timeout expiry releases the member. Approval refuses a timeout subsequently modified by another moderator and remains available after plan expiry.
- Scam/URL detection uses configured domains and heuristics, not a reputation feed. It does not fetch links or expand redirects. False positives and evasions are possible.
- Voice protection detects rapid joins/switches, not audio content. Basic AutoMod is application-side, requires the bot online and Message Content intent.
- Lockdown modifies five messaging permission bits on selected channels' @everyone overwrites. Administrator and explicit role/member allows bypass it. Unlock restores those bits while preserving unrelated permission changes and remains available after expiry.
- One backup per guild stores role metadata, supported categories/text/announcement/voice channels and VEX settings. Restore recreates MISSING structure with new IDs/remapped overwrites. It does not overwrite existing resources or restore messages, member roles, exact role order or automatically apply archived settings. A separate owner-confirmed action restores archived VEX settings and remaps resource IDs. Channels with missing required overwrite roles/parents are skipped. Results report each failure. A persisted ID map prevents repeat restore duplication.
- Logs retain the latest 1,000 events/server; UI shows 100; reports export 1,000. No message contents are stored. Scanner score is a checklist, not a guarantee. Owner DMs may fail if DMs are disabled; local logs remain.

## Commands

`/help`, `/security`, `/verify member`, `/scan`, `/lockdown enabled`. Help and security now show a private interactive embed with Basic, Plus, Ultimate and a dashboard link. Global registration replaces the old AI/voice/general command list.

## Validation

`npm run check`; `npm test`. Tests cover filters, expiry, tenant isolation, permissions, authentication, CSRF and plan enforcement. Destructive recovery needs testing in a dedicated Discord test server before public release.

## Per-event server logs

Server logs provides 50 independent event controls across members, messages, moderation, channels/threads, roles, voice, and server changes. Each event has an enable switch, its own text/announcement destination channel, and a six-digit embed color. Includes search, category filters, preview and four dashboard languages. All new log events default OFF. Save applies the configuration; enabled events require a valid destination and View Channel, Send Messages and Embed Links. Audit-derived events additionally require View Audit Log.

Only events observed while the bot is online are recorded. Message bodies and attachments are not retained; edits/deletions log available IDs. Uncached authors may be unavailable. Audit entries provide actors only for the corresponding audit events; no actor is guessed for gateway events. Moderator voice move/disconnect records may include a count without individual target IDs. Timeout expiry may not generate a Discord member-update event. The existing 1,000-event retention is shared with security incidents. Backup restoration remaps log destinations, disabling unavailable ones.

Validation includes per-event merge behavior, tenant isolation, disabled delivery, selected color/routing, metadata-only message records, audit actor handling, and channel/permission enforcement.

## Community OS 3.0

Adds 15 configurable modules alongside the existing 34 security modules and 50 log events: server identity, embed studio, welcome/goodbye, auto responses, XP and rank rewards, join roles, self roles, starboard, temporary voice rooms, finite invites, activity counts, support tickets, moderation and creator feeds.

Dashboard: Community modules opens the directory. Each module has typed controls, channel/role selectors, repeatable rules where relevant, and saved-state previews. Tickets, role menus and announcements have an explicit Publish action. Moderation actions and their casebook are together in one section; Control panel logs remain a separate view. Welcome settings appear only in the Welcome module. Dashboard navigation, module descriptions and core controls support English, Arabic, Sorani Kurdish and Turkish. Discord command text currently uses English; custom messages can use any language.

Commands: `/rank`, `/leaderboard`, `/roles`, `/ticket`, `/invite`, `/room`, `/moderate`, `/cases`, plus the existing security commands. New community modules default OFF and are available without a paid entitlement in this release. Existing Plus/Ultimate security access rules remain enforced. No billing has been activated.

- Tickets deny @everyone View Channel and allow only the requester, support role and bot (Discord administrators can still access). One open ticket per member. Closing preserves the channel but denies the requester further messages; staff may reopen or claim it.
- Assigned roles must be below VEX and cannot contain administrative/moderation powers. Existing support-team roles are not assigned by the bot.
- XP ignores bots, short messages, consecutive identical text and messages inside the configured cooldown. Only a hash of the last awarded text is stored. Rewards are cumulative. Counts are retained for 90 days; the dashboard shows 30 days.
- Starboard counts up to 100 fetched reactors and ignores bots and self-stars. It copies message text only when the source and destination are visible to @everyone. Removed source messages are not guaranteed to remove already-published cards.
- Temporary rooms are removed when empty. Room ownership and ticket records require persistent storage. `/room` only controls the caller's own VEX room.
- Moderation enforces the caller's Discord permissions and role hierarchy. Dashboard actions require a server-name confirmation. Clear skips messages older than 14 days. Case records store actor, target, reason and time.
- Restore-settings disables restored community modules for review of their channel/role references.

### Creator feed configuration

Operator-side environment variables (never put secrets in dashboard messages):

| Provider | Variables | Dashboard source |
| --- | --- | --- |
| YouTube | `YOUTUBE_API_KEY` | Channel ID beginning `UC` |
| Twitch | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Username |
| Kick | `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET` | Numeric broadcaster user ID |
| Reddit | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_REFRESH_TOKEN` | Subreddit name |

Providers may require approved application access and have quotas. This update does not obtain or activate those credentials. The dashboard shows missing keys, latest provider errors and last successful check. Checks run every ten minutes through fixed official API hosts; the first successful check records a baseline without posting old content. Notifications are deduplicated per source/destination; failed sends retry at the next poll. Only the newest five uploads/posts are fetched, so high-volume feeds can have gaps. Credentials are held server-side. Live-stream notifications can miss broadcasts shorter than the poll interval. Integrations require live validation after credentials are configured.

Keep one replica and mount durable storage before opening the bot to the public. Automated tests cover schema bounds, tenant isolation, XP cooldowns, role safety, ticket privacy/duplicates, authorization and notification baseline/retry behavior. Destructive moderation and external providers are not exercised against real members by automated tests.
