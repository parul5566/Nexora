# Phase 6 — Modules 14–17: Communities, Professional Profiles, Companies, Jobs

## Module 14 — Communities
**Features:** create community, join/leave, invite, member roles (owner/admin/moderator/member), community posts, rules, pinned posts, discovery; **private communities secure** — content invisible to non-members at API level (IDOR-checked).

**Acceptance criteria:**
- [ ] User creates a community, others discover and join; leaving works
- [ ] Community post appears in community feed; pinning works for admins only
- [ ] Role actions enforced: only admins/mods can pin/moderate; only owner assigns admins
- [ ] Private community: non-member direct API request for its posts returns 403/404, and it's excluded from search

## Module 15 — Professional Profiles
**Features:** experience, education, skills, certifications, projects, recommendations (given/received), professional mode toggle — integrated into the existing profile, **no separate identity**.

**Acceptance criteria:**
- [ ] User adds/edits/removes each section; entries persist in correct order (dated)
- [ ] Sections render on the public profile in a professional layout
- [ ] Recommendations: written by connection → pending → accepted by recipient; visible on profile
- [ ] Professional mode changes what the profile emphasizes without breaking social features

## Module 16 — Company Pages
**Features:** company creation, company profile, employees (affiliated members), company posts, followers, admin roles, recruiter roles, company analytics (follower growth, post engagement — real aggregates).

**Acceptance criteria:**
- [ ] Authorized user creates a company; others follow it; follower count correct
- [ ] Company posts appear to followers/company page; posted as the company, not the individual
- [ ] Admin/recruiter role actions enforced (recruiter can post jobs, not change branding)
- [ ] Analytics show real numbers matching DB aggregates

## Module 17 — Jobs
**Features:** create job (recruiter/admin), job listings, job search (filters: title/location/type), job detail, apply (with profile/resume), application status tracking, employer view of applicants, save job.

**Acceptance criteria:**
- [ ] Recruiter posts a job; it appears in search/listings with filters working
- [ ] User applies; employer sees the applicant with profile link; status updates (viewed/rejected/hired) notify the applicant
- [ ] Saved jobs list works; applying twice is prevented
- [ ] Only companies/recruiter roles can create jobs

**Tests:** integration (permissions per role), E2E (company→job→apply→status chain).
