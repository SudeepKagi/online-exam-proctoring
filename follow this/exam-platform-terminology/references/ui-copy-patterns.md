# UI copy patterns

How to phrase buttons, dialogs, messages, and states using the glossary terms.

Contents: 1 Style rules - 2 Canonical button sets - 3 Confirm dialogs - 4 Errors - 5 Empty states and toasts - 6 Warnings to students - 7 Dates, numbers, accessibility

## 1. Style rules

- Sentence case for all UI text: "Start exam", not "Start Exam".
- Actions: verb + object, 1-3 words. Never "Submit" alone, "OK", "Yes", "No", "Click here".
- No trailing period on buttons or labels. No exclamation marks except in a real success moment (rare).
- One primary button per screen or dialog. Dismiss is always "Cancel".
- Use "..." only when the button opens a step that needs more input ("Add question...").
- Say what the user gets, not what the system does: "Save changes", not "Persist data".
- Plain words: "Use" not "Utilize", "Start" not "Initiate", "Check" not "Validate".
- Never show technology names, internal codes, or raw error strings.

## 2. Canonical button sets

| Screen | Buttons (exact labels) |
|---|---|
| Sign in | Sign in - Forgot password? |
| First sign-in | Change password - Save password |
| Complete profile | Upload photo - Save changes - Submit for approval |
| Student dashboard | Start exam (only when Live) - View instructions - View result |
| Exam check-in | Allow camera access - Allow screen sharing - Download desktop app - Take photo - Retake photo - Verify identity - Enter full screen - Start exam |
| Exam screen | Save & next - Previous - Mark for review - Clear answer - Review answers - Submit exam |
| Review answers screen | Back to exam - Submit exam |
| Teacher exam form | Save draft - Add question - Generate with AI - Schedule exam - Cancel |
| Teacher exam list | Create exam - Edit exam - Duplicate exam - Delete exam |
| Live monitoring | Send warning - End exam for student - View evidence |
| Flag review | Mark as cleared - Confirm violation |
| Results (Teacher) | Release results - Export results |
| Admin users | Add user - Edit user - Reset password - Suspend - Reactivate |
| Admin approvals | Approve - Reject |

## 3. Confirm dialogs

Pattern: the title asks, the body states the consequence, the confirm button repeats the action and object, and dismiss is "Cancel".

| Situation | Title | Body | Confirm | Dismiss |
|---|---|---|---|---|
| Submit exam | Submit exam? | You answered 18 of 25 questions. You can't change your answers after submitting. | Submit exam | Back to exam |
| Delete exam | Delete exam? | "Data Structures Midterm" and its results will be permanently deleted. | Delete exam | Cancel |
| Suspend user | Suspend this user? | They won't be able to sign in until you reactivate them. | Suspend | Cancel |
| End exam for student | End exam for Asha R.? | Their answers so far will be submitted. This can't be undone. | End exam for student | Cancel |
| Leave unsaved form | Leave without saving? | Your changes to this exam will be lost. | Leave | Stay |

For irreversible actions with large impact (deleting an exam that has results), also require typing the exam title before the confirm button enables.

## 4. Errors

Formula: what happened, why (only if helpful), what to do next. No codes, no blame, no dead ends.

| Situation | Message |
|---|---|
| Camera blocked | Camera access is blocked. Allow camera access in your browser settings, then select Try again. |
| Screen sharing declined | Screen sharing is required for this exam. Select Allow screen sharing to continue. |
| Identity mismatch | We couldn't match your photo to your reference photo. Check your lighting and select Retake photo. |
| Connection lost | Connection lost. Your answers are saved. Reconnecting... |
| Wrong credentials | The USN or password is incorrect. Check both and try again. |
| Exam not started | This exam starts on 18 Oct 2026, 10:00 AM. You can start it then. |
| Not authorised | You don't have access to this page. Go to your dashboard. |
| Server failure | Something went wrong on our side. Try again in a moment. |
| Upload too large | That photo is too large. Choose a photo under 5 MB. |

## 5. Empty states and toasts

Empty state formula: say what will appear here, then give the next action.

| Screen | Message | Action |
|---|---|---|
| Student, Upcoming exams | No upcoming exams. Exams assigned to your branch and semester will appear here. | |
| Teacher, Exams | You haven't created any exams yet. | Create exam |
| Admin, Approvals | No profiles are waiting for approval. | |
| Live monitoring | No exams are live right now. | |

Toasts: confirm the result in past tense, 6 words or fewer. "Exam saved", "Warning sent", "User approved", "Password changed". Offer Undo for reversible actions only.

## 6. Warnings to students

Calm, factual, non-accusatory. Name the event, say what to do, show the count.

- "Warning 1 of 3: You left full screen. Return to full screen to continue."
- "Warning 2 of 3: Your face isn't visible. Look at the camera."
- Never: "Cheating detected", "Violation", "You have been caught".

## 7. Dates, numbers, accessibility

- Dates: "18 Oct 2026". Time: 12-hour with AM/PM ("10:00 AM"). Show the time zone on scheduled exams.
- Durations: "90 minutes". Progress: "18 of 25 answered". Score: "18 / 25".
- Every input has a visible label; placeholders are examples, never labels.
- Status is never colour-only: pair the colour with a text label or icon.
- A button's accessible name equals its visible label.
