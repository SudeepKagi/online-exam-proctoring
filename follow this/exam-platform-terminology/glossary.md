# Glossary: canonical terms

Use the **Use** column exactly (spelling and case). Never use anything in **Don't use** for the same concept. Sentence case everywhere except acronyms and proper nouns (USN, MCQ, AI).

Contents: 1 Roles and accounts - 2 Navigation - 3 Exam setup - 4 Statuses - 5 Check-in - 6 During the exam - 7 Proctoring - 8 Results - 9 Admin - 10 System - 11 Never in user-facing text - 12 Decision points - 13 Pending terms

## 1. Roles and accounts

| Use | Don't use | Notes |
|---|---|---|
| Student | Examinee, Candidate, Test taker, Learner | Vendors say candidate/test taker; every user here is an enrolled student |
| Teacher | Faculty, Instructor, Professor, Staff, Educator | See decision point D1 |
| Admin | Super admin, Superuser, Root, Manager, Moderator | |
| Developer | Dev, Operator, Maintainer | Sees System health only |
| Sign in / Sign out | Log in, Login (as a verb), Logout, Authenticate | "Sign-in" as an adjective is fine |
| Forgot password? | Recover credentials, Reset access | |
| Change password | Update credentials, Modify passkey | |
| Temporary password | Initial passkey, One-time key, Default credentials | Issued by Admin, must be changed at first sign-in |
| Profile | Account details, Identity card | |
| Complete your profile | Finish onboarding, Initialize profile | |
| USN | Roll no., Registration number | Helper text: "University seat number" |
| Employee ID | Emp ID, Staff code | Spell it out |
| Branch | Stream, Department, Discipline | See D2 |
| Semester | Term, Sem | |
| Reference photo | Base image, Biometric template, Face ID, Selfie | Profile photo used for identity verification |
| College ID | ID proof, Institute card | |

## 2. Navigation and pages

| Use | Don't use | Notes |
|---|---|---|
| Dashboard | Home, Hub, Command center, Control panel | |
| Exams | Tests, Assessments, Examinations, Papers, Quizzes | |
| Results | Scorecard, Marksheet, Performance, Outcomes | |
| Live monitoring | Surveillance, Watchtower, Live ops, Proctoring room | Teacher's real-time view of a running exam |
| Users | Members, People, Identities | Admin list |
| Approvals | Verification queue, Onboarding queue, Gatekeeping | Admin queue of profiles waiting for a decision |
| System health | Telemetry, Observability, Diagnostics, Vitals | Developer dashboard |
| Notifications | Alerts feed, Updates stream | "Alert" is reserved for nothing; avoid it in UI |
| Settings | Preferences, Configuration, Control center | |

## 3. Exam setup (Teacher)

| Use | Don't use | Notes |
|---|---|---|
| Create exam | New exam wizard, Compose exam, Add test | |
| Edit exam | Modify, Reconfigure | |
| Duplicate exam | Clone, Replicate, Fork | |
| Delete exam | Destroy, Purge, Remove permanently | Needs a confirm dialog |
| Exam title | Exam name, Exam heading | |
| Instructions | Briefing, Exam brief, Guidelines | Exam-specific text shown before start |
| Exam rules | Protocol, Conduct code, Terms of engagement | What is and is not allowed; same for every exam |
| Duration | Time limit, Time allotted, Exam length | In minutes |
| Start time / End time | Opens at, Launch time, Window begins | |
| Branch and semester | Target audience, Cohort, Batch | Each exam is assigned to one branch and one semester |
| Question | Item, Prompt, Problem | |
| Options | Choices, Alternatives | The answer choices of an MCQ |
| Correct answer | Right option, Solution, Answer key | |
| Marks | Points, Weightage | Per question |
| Total marks | Max score, Maximum points | |
| Add question | Insert item, New prompt | |
| Generate with AI | AI magic, AI-powered creation, Auto-generate | Plain label plus an "AI" badge, never "smart" or "intelligent" |
| Save draft | Store, Keep, Save progress | |
| Schedule exam | Publish, Deploy, Launch, Activate, Go live | Moves Draft to Scheduled |

## 4. Statuses

| Use | Don't use | Notes |
|---|---|---|
| Draft | Unpublished, Incomplete, WIP | Exam status |
| Scheduled | Queued, Armed, Published | Teacher/Admin view |
| Upcoming | Pending, Future | Same state, Student view |
| Live | Active, Running, Ongoing, Open | Exam is in its time window |
| Completed | Ended, Finished, Closed, Expired | |
| Cancelled | Aborted, Terminated, Voided | |
| Missed | Absent, Skipped, Expired | Student never started |
| Not started / In progress / Submitted | Idle, Running, Finalized | A student's own progress in an exam |
| Pending approval | Awaiting verification, In queue, Unverified | Account status |
| Active | Enabled, Verified | Account status only (never for exams) |
| Suspended | Banned, Blocked, Locked, Disabled, Deactivated | Account status |
| Rejected | Denied, Declined | Account status |

## 5. Check-in (before the exam)

| Use | Don't use | Notes |
|---|---|---|
| Exam check-in | Pre-flight, Gateway, Entry protocol | The steps before Start exam |
| System check | Compatibility scan, Diagnostics, Environment audit | Camera, microphone, screen sharing, browser, connection |
| Allow camera access | Enable webcam stream, Grant media device | |
| Allow screen sharing | Grant display capture, Share display | |
| Verify identity | Authenticate face, Biometric scan, Face scan | Compares the live photo with the reference photo |
| Take photo / Retake photo | Capture frame, Snap, Re-scan | |
| Enter full screen | Engage lockdown, Activate secure mode | "Full screen" as noun, "full-screen" as adjective |
| Download desktop app | Install agent, Get BYOD client | UI only; code may say "device agent" |
| Desktop app | Agent, Device agent, Companion, BYOD client | UI only |
| I agree to the exam rules | Accept protocol, I consent | Checkbox label |
| Start exam | Begin, Launch, Commence, Initiate, Enter exam hall | The one and only start action |

## 6. During the exam (Student)

| Use | Don't use | Notes |
|---|---|---|
| Question palette | Navigator grid, Question map, Quiz navigation | Side panel of numbered questions |
| Answered / Not answered / Not visited | Completed, Pending, Unseen | Palette legend |
| Marked for review / Answered and marked for review | Flagged, Bookmarked, Starred | "Flag" is reserved for proctoring |
| Save & next | Confirm & proceed, Lock answer | |
| Previous | Back, Prior | |
| Mark for review | Flag question, Bookmark, Revisit later | |
| Clear answer | Reset, Erase, Wipe | See D3 |
| Time remaining | Time left, Countdown, Clock | |
| Review answers | Summary of attempt, Audit, Pre-submit check | Summary screen before submitting |
| Submit exam | Finish attempt, Finalize, End exam, Terminate | Confirm dialog required |
| Warning | Violation, Strike, Infraction, Alert | What the student sees: "Warning 2 of 3" |
| Connection lost / Reconnecting | Socket disconnected, Network anomaly | |
| Auto-submitted | Force-closed, Timed out | When time ends |

## 7. Proctoring and monitoring (Teacher)

| Use | Don't use | Notes |
|---|---|---|
| Flag | Violation, Anomaly, Incident, Infraction, Suspicious event | Automatic or manual note that something may break the rules; can be a false positive |
| Severity: Low, Medium, High | Threat level, Risk score, Criticality, P1/P2 | |
| Evidence | Proof, Artifacts, Captures | Screenshots or recordings attached to a flag |
| Send warning | Reprimand, Strike, Ping | Teacher to student, during the exam |
| End exam for student | Kick, Terminate, Eject, Ban | Confirm dialog required |
| Exam session | Proctoring room, Feed room, Stream | One student's monitored time in one exam |
| Live view | Camera wall, Surveillance grid | Tiles of students in Live monitoring |
| Cleared | Dismissed, Resolved, Innocent | Review outcome: flag judged harmless |
| Violation confirmed | Guilty, Cheating confirmed | Review outcome; the only place "violation" is allowed |
| Session report | Incident dossier, Cheat report, Suspicion summary | Per-student summary after the exam |

Flag types (use these names): Tab switch - Left full screen - Face not visible - Multiple faces - Identity mismatch - Camera turned off - Screen sharing stopped - Developer tools opened - Copy or paste attempt - Connection lost.
Never: Focus loss, Visibility change, Blur event, Gaze deviation, Anomaly detected.

## 8. Results

| Use | Don't use | Notes |
|---|---|---|
| Score | Marks obtained, Points earned | Shown as "18 / 25" |
| Percentage | Pct, Ratio | |
| Correct / Incorrect / Unanswered | Right / Wrong / Blank / Skipped | |
| Release results | Publish, Declare, Unlock | Teacher makes results visible |
| Export results | Dump, Extract | CSV or PDF |

## 9. Admin

| Use | Don't use | Notes |
|---|---|---|
| Add user | Register, Onboard, Provision, Create identity, Enroll | Admin is the only way accounts are created |
| Approve / Reject | Verify, Accept, Deny, Greenlight | |
| Suspend / Reactivate | Ban / Unban, Block / Unblock, Disable / Enable | |
| Reset password | Regenerate credentials | Issues a new temporary password |
| Audit log | Event ledger, Trace dump | Record of admin actions |

## 10. System (Developer)

| Use | Don't use | Notes |
|---|---|---|
| Operational / Degraded / Down | Healthy / Unhealthy, Green / Red | Service status values |
| Active exam sessions | Live sockets, Connections, Streams | |
| Logs | Trace dump, Event ledger | |

## 11. Never in user-facing text

Full list lives in `deny-list.txt` and is enforced by `scripts/check-terms.mjs`.

- **Branding metaphors:** Command Center, Mission Control, Nexus, Sentinel, Guardian, Watchtower, Vault, Arena, Launchpad, Cockpit, Beacon.
- **Military or security theatre:** Initiate, Deploy, Engage, Terminate, Eject, Neutralize, Breach, Threat, Strike.
- **Hype:** Smart, Intelligent, AI-powered, Next-gen, Seamless, Revolutionary, Supercharged.
- **Technology names:** WebRTC, Socket, SFU, Redis, RabbitMQ, Prisma, Postgres, S3, EC2, DeepFace, OpenCV, Tesseract, Flask, JWT, token, payload, endpoint, stack traces, "Internal server error". The UI shows services, not the stack.
- **Accusatory words to students:** cheating, cheater, fraud, guilty, caught, suspect. Say "Warning" and describe what happened neutrally.
- **Jargon:** Anomaly, Heuristic, Telemetry. "Biometric" appears only in the privacy notice.
- **Style:** ALL CAPS labels, emoji in labels, stacked exclamation marks.

## 12. Decision points

Industry has two valid conventions for each. A choice is made below; **never mix both in one product**. Change the choice here, then run a project-wide rename.

| ID | Choice | Alternative | Why this default |
|---|---|---|---|
| D1 | Teacher | Faculty | Matches the four role names used by the product; "Faculty" is equally common in Indian colleges, so switch globally if preferred |
| D2 | Branch | Department | Matches student profile fields |
| D3 | Clear answer | Clear response | Plainer English; "Clear response" is familiar from NTA/TCS iON-style exams and is the right pick if exact familiarity matters more |
| D4 | Proctoring (feature, automated monitoring) and Live monitoring (the Teacher screen) | Invigilation | Product is built around "proctoring"; do not use "invigilator" and "proctor" for the same thing |
| D5 | Sign in | Log in | Used by Microsoft, Google, and Apple |

## 13. Pending terms

Agents add rows here instead of inventing terms. A human approves, moves the row into the right table above, and deletes it here.

| Proposed term | Where it is used | Concept | Proposed by / date | Status |
|---|---|---|---|---|
| | | | | |
