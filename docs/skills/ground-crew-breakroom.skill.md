---
name: ground-crew-breakroom
description: >
  Generate, draft, and manage Breakroom content for Ground Crew HQ (/app/breakroom).
  Use this skill whenever the user wants to post a team announcement, write a shift
  handoff note, draft a safety reminder, send a shoutout to a crew member, or create
  any internal team communication. Trigger on: "post to the breakroom", "write an
  announcement", "shift handoff", "safety reminder", "shoutout for", "team message",
  "end of day notes", "heads up for the crew".
---

# Ground Crew Breakroom Skill

## Live Database Reference
**Project ID:** `fjqeekwisnbpxgebrnpl`
**Org ID:** `bb13da4a-d2de-4fc9-ad5a-bfd266e08807`
**Property:** Sarasota Polo Club (`b50b42cd-903e-4280-9373-1d9cae97b2b3`)

### Team
| Name | ID | Role |
|------|----|------|
| Basil Lowell | `738d599f-0309-489a-8275-e29ec7239e87` | Platform Admin |
| Leo Tsosie | `234973b0-c4a3-44e1-b7a8-1a7133795bf2` | Field Staff |

## Real Schema — `notes` table
The Breakroom uses the `notes` table (org-scoped, property-scoped):
```sql
id          uuid DEFAULT gen_random_uuid() PRIMARY KEY
org_id      uuid REFERENCES organizations(id)
property_id uuid REFERENCES properties(id)
type        text DEFAULT 'general'   -- 'announcement'|'handoff'|'safety'|'shoutout'|'general'
title       text NOT NULL
content     text DEFAULT ''
location    text                     -- optional area/zone reference
created_by  uuid REFERENCES app_users(id)
created_at  timestamptz DEFAULT now()
```

## Insert a Post
```sql
INSERT INTO notes (org_id, property_id, type, title, content, created_by)
VALUES (
  'bb13da4a-d2de-4fc9-ad5a-bfd266e08807',
  'b50b42cd-903e-4280-9373-1d9cae97b2b3',
  'announcement',
  'Your title here',
  'Your message content here',
  '738d599f-0309-489a-8275-e29ec7239e87'  -- Basil as author
);
```

## Message Types

| Type | Use For | Format |
|------|---------|--------|
| `announcement` | Schedule changes, client visits, policy | Prose, pin-worthy |
| `handoff` | EOD notes to next shift | Bullets: done / unfinished / issues / next |
| `safety` | Hazard alerts, PPE, weather warnings | Firm bullets, always important |
| `shoutout` | Recognizing crew | 2–4 sentences, genuine, casual |
| `general` | FYI, reminders, questions | Short prose |

## Tone Guide
| ✅ Use | ❌ Avoid |
|--------|---------|
| "Heads up team —" | "Please be advised" |
| "Leo crushed the north fields today" | "Performance was commendable" |
| "Don't forget PPE tomorrow — heat index 105" | "Ensure protocol compliance" |
| "Blower's out — grab the backup from barn" | "Equipment temporarily unavailable" |

## Output Format
Always show:
1. **Preview** of the post
2. **SQL insert** ready to run

### Preview:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📢 ANNOUNCEMENT
From: Basil · May 7, 2026

[Title]

[Content]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Query Recent Posts
```sql
SELECT type, title, content, created_at
FROM notes
WHERE org_id = 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807'
ORDER BY created_at DESC
LIMIT 10;
```
