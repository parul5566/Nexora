# Nexora UI Redesign — Facebook-Clone Design System

## Goal
Make the Nexora web app look exactly like the attached Facebook-clone mockup on both
mobile (390px) and desktop (1440px), while keeping every existing feature and API route working.

## Design tokens (replace globals.css)
| Token | Value |
|---|---|
| --fb-blue (primary) | #1877F2 |
| --fb-blue-hover | #166FE5 |
| --fb-tint (selected bg) | #E7F3FF |
| --fb-canvas (page bg) | #F0F2F5 |
| --fb-surface (cards) | #FFFFFF |
| --fb-border | #E4E6EB |
| --fb-text | #050505 |
| --fb-text-secondary | #65676B |
| dividers | 1px #E4E6EB |
| radius | cards 12–16px, inputs 10px, pill CTAs 999px, small action buttons 6–8px |
| typography | system font; bold headings ~22px, body 14–16px, meta 12–13px |
| icon accents (composer) | green photo/video, blue tag, yellow feeling, pink check-in, red live |
| sent message bubble | #1877F2 white text; received #E4E6EB dark text |

Dark scheme is REMOVED from defaults — the mockup is a light Facebook theme.

## Layout shells
- **Mobile (<900px)**: white top bar (Nexora wordmark blue, search + messenger icons right),
  gray canvas, white cards edge-to-edge-ish, sticky bottom nav with 5 items
  (Home, Friends, Watch→Reels, Notifications, Menu) — active blue, gray inactive, unread blue dot badge.
- **Desktop (≥900px)**: white top bar full width (blue wordmark left; round search field;
  right icons Home/Friends/Watch/Notifications/Messenger + avatar menu). Below: 3 columns —
  left sidebar nav (profile row, Friends, Groups, Messenger, Watch, Events, Jobs, Saved, Settings),
  center feed column (~600px), right rail (Contacts = online-style user list → /messages, sponsored/trends optional).

## Shared components (new file: components/shell.tsx)
- `AppShell({ active, children })` — top bar + left sidebar + right rail + mobile bottom nav.
- `BottomNav`, `TopBar`, `SideLink`, `ContactsRail` (loads /api/v1/conversations + follows for faces).
- `FbCard` wrapper, `PillButton`, `ChipRow` (pill tabs with #E7F3FF selected state).

## Screens → routes (existing features preserved)
| Screen | Route | Notes |
|---|---|---|
| Splash | `/` (logged out) | full-bleed #1877F2, white round f/N logo, tagline, white pill "Get Started" → /register, "Log in" link. Logged-in `/` stays a redirect to /home. |
| Login | /login | blue logo, "Welcome Back", outlined inputs w/ password eye toggle, blue pill Log In, Forgot password, Sign up link (Google/Apple buttons visual-only or omitted if no backend — show disabled with tooltip) |
| Register | /register | "Create Account / It's quick and easy", Full name, Mobile/Email, Password (+ username field kept — API requires it), blue pill Sign Up; keeps existing verify-token step |
| Home Feed | /home | StoryBar (FB-style cards), Composer ("What's on your mind?" + color-coded action row), feed tabs as chips (For you / Friends / My posts / Drafts), post cards, right rail contacts |
| Create post | inside Composer | modal-style options row: 📷 Photo/Video green, 👥 Tag blue, 😊 Feeling yellow, 📍 Check-in pink, 🔴 Live red (photo/upload + poll + visibility are real; the rest are visual menu entries that reuse real features where they exist) |
| Comments | PostCard | FB-style: bubble rows, like/reply inline, 2-level threads (existing) |
| Notifications | /notifications | pill chip tabs All / Likes / Comments / Mentions (+ Follows), unread row tint #E7F3FF, icon badges. Needs API: `GET /notifications?type=` filter (like|comment|mention|follow) |
| Friends | /friends (NEW) | tabs: Followers / Following / Connections+requests; rows with avatar, name, action buttons (Follow back / Accept / Remove) using existing follows + connections endpoints |
| Search | /search | FB gray rounded search field, chips People/Posts/Hashtags, trending section |
| Profile | /u/[username] | cover photo, overlapping avatar, name + bio, blue action buttons (Follow/Following pill, Message), tabs Posts / About / Friends (friends tab shows follower/following lists) |
| Edit profile | /settings/profile | FB "Edit profile" card layout with photo rows + form fields (existing functionality) |
| Messenger | /messages | desktop 2-pane (chat list + thread), mobile list → thread view; blue sent bubbles #1877F2, gray received, rounded avatars, composer pill |
| Groups | /communities | FB Groups grid cards (cover, name, members, Join/Joined pill), group detail keeps existing features |
| Settings | /settings | menu list with chevrons; keep existing settings/profile + add links to other settings surfaces |
| All other pages | /bookmarks /reels /events /jobs /companies /analytics /admin /hashtag | inherit tokens automatically via globals.css; sweep inline styles that reference removed vars; make each page render inside AppShell |

## API additions (minimal)
1. `GET /api/v1/notifications?type=` — filter by type (client tabs otherwise fetch 50 and miss older ones).
2. Nothing else — friends/groups/messenger reuse existing endpoints.

## Non-goals
- No new backend features beyond the notification type filter.
- No real Google/Apple OAuth (buttons omitted unless a backend exists).
- Dark mode removal from default tokens (can return later behind a flag).
