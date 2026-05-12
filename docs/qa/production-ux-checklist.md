# Production UX QA Checklist

Target URL: `https://dream-spark-pro.vercel.app`  
Goal: Verify first-time UX flow in 5 minutes.

## 1) Test Metadata

- Tester:
- Date:
- Environment: Desktop / Mobile / Both
- Browser:
- Build URL:
- Notes:

## 2) Quick Smoke (5 minutes)

### A. First-touch clarity
- [ ] Open app and hard reload (`Cmd+Shift+R`).
- [ ] First screen clearly communicates what to do next.
- [ ] "First 5 minutes" guidance is visible and understandable.
- [ ] No blocking error banner appears.

Result / Notes:

---

### B. Onboarding path
- [ ] Login works.
- [ ] Onboarding start state appears for first session (or expected skip behavior).
- [ ] "Skip and start" works and lands user in an actionable page.
- [ ] User understands they can proceed without completing all setup.

Expected events:
- `signup_completed`
- `onboarding_started`
- `onboarding_completed`

Result / Notes:

---

### C. First AI consult
- [ ] "AI consult" entry point is visible in bottom navigation.
- [ ] Quick-start action opens AI consult screen.
- [ ] Template prompt (or clear starting text) is available.
- [ ] Submit works and assistant response appears.

Expected events:
- `first_ai_consult_started`
- `first_ai_consult_completed`

Result / Notes:

---

### D. First post
- [ ] Quick-start action opens post composer.
- [ ] Starter template text can be inserted.
- [ ] Post submit succeeds and appears in feed.
- [ ] Empty state has actionable CTA (not only explanatory text).

Expected events:
- `first_post_started`
- `first_post_completed`

Result / Notes:

---

### E. First question
- [ ] Quick-start action opens question area.
- [ ] Question template fills title/body.
- [ ] Submit succeeds and question appears in list.
- [ ] Empty state includes clear action buttons.

Expected events:
- `first_question_started`
- `first_question_completed`

Result / Notes:

---

### F. Search and DM
- [ ] Quick-start action opens search/chat list.
- [ ] Search can run at least once.
- [ ] DM can be opened from a result.
- [ ] Error messages are understandable when permission is denied.

Expected events:
- `search_started`
- `dm_started`

Result / Notes:

---

### G. Mobile UX
- [ ] Bottom nav labels are readable.
- [ ] Touch targets are easy to tap.
- [ ] No critical overlap with safe area.
- [ ] Core actions can be completed one-handed.

Result / Notes:

---

### H. Trust and safety
- [ ] Public visibility is explained where user posts/questions.
- [ ] Warning against sharing personal info is visible.
- [ ] Report path is discoverable.
- [ ] AI disclaimer is visible and understandable.

Result / Notes:

## 3) Pass/Fail Gate

- [ ] PASS if all sections A-F are green and no blocker in G-H.
- [ ] FAIL if any core journey (AI, post, question, DM) cannot complete.

Overall status: PASS / FAIL

## 4) Release Decision

- [ ] Ship now
- [ ] Ship with known minor issues
- [ ] Hold release

Reason:

