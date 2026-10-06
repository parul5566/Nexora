# Phase 7 — Modules 18–21: Events, Creator Dashboard, Moderation, Admin Panel

## Module 18 — Events
**Features:** create event, RSVP (going/interested/not), attendees list, public/private events, online events (link) and location events, event discussion, reminders.

**Acceptance criteria:**
- [ ] User creates an event; others RSVP; attendee counts/list accurate; RSVP changeable
- [ ] Private event visible only to invitees; online event shows join link only to RSVPs if configured
- [ ] Event discussion posts visible to attendees; reminder notification fires per schedule

## Module 19 — Creator Dashboard
**Features:** content analytics (post/reel/story performance), audience analytics, followers, reach, engagement, watch time — **real aggregated analytics** from event data, no fake numbers.

**Acceptance criteria:**
- [ ] Dashboard shows per-post/per-reel stats that match actual DB counts for the logged-in creator
- [ ] Follower growth and reach computed from real events over selectable time ranges
- [ ] Watch time aggregated from Module 13 watch events
- [ ] Another user's data is never visible (authorization)

## Module 20 — Moderation
**Features:** report content/users/communities/jobs/messages; moderation queue; moderator actions (remove, warn, restrict, suspend, ban); restoration; audit trail.

**Acceptance criteria:**
- [ ] Any user can report any reportable object with a reason; duplicate reports merge or coexist sensibly
- [ ] Moderators see a queue, act on a report, and the action's effect is visible (content removed / user restricted)
- [ ] Banned user cannot log in; restricted user's limits enforced
- [ ] Restoring content reverses the removal; every action written to the audit trail
- [ ] Non-moderators cannot access moderation APIs

## Module 21 — Admin Panel
**Features:** dashboard, user management, content management, reports, moderation, communities, companies, jobs, system analytics, audit logs, admin roles, permission management. **Admin APIs never exposed to normal users.**

**Acceptance criteria:**
- [ ] Admin login reaches the admin panel; normal users get 403 on every admin route/API
- [ ] Admin can search/manage users (suspend, unsuspend), edit/remove content, view all reports
- [ ] System analytics show real platform aggregates
- [ ] Audit log records admin actions with actor and timestamp; second admin role with fewer permissions is denied the restricted actions

**Tests:** integration (role/permission matrix), E2E (report→moderate→restore chain; admin privilege denial for normal user).
