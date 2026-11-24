# Secure Browser Integration

ProctorNet integrates with Safe Exam Browser (SEB) to provide a locked-down examination environment on student computers.

## What It Is

Safe Exam Browser turns any computer into a secure workstation. During an exam, the software restricts candidate access to unauthorized resources.

- Disables keyboard shortcuts, task switching, and secondary monitors.
- Blocks web browsing to unapproved domains and search engines.
- Prevents opening screen recorders, developer tools, or communication apps.
- Validates browser identity using cryptographic request headers.

## Administrator Setup

1. Open the **Admin Dashboard** and select the **Secure Browser Settings** tab.
2. Enter your institutional configuration key or upload an institutional `.seb` configuration file.
3. Configure exit passwords and allowed URL parameters for exam sessions.
4. Save settings to apply the configuration across all exams requiring browser lockdown.

## Student Pre-Check

When an exam mandates browser lockdown, the student workflow includes a secure browser check:

1. The pre-exam screen notifies the student that Safe Exam Browser is required.
2. The student clicks **Download Configuration File** to receive the exam `.seb` profile.
3. Opening the downloaded file launches Safe Exam Browser in kiosk mode.
4. The server validates the application request headers and unlocks the examination arena.

## Top 5 Troubleshooting Items

1. **Missing Request Header Error**: Ensure you launched the exam directly by opening the `.seb` file rather than typing the URL in standard Chrome.
2. **Invalid Configuration Key**: Ask your institution administrator to verify that the active exam configuration key matches the institutional `.seb` file.
3. **Dual Monitor Detected**: Disconnect external displays and projectors before launching the secure browser.
4. **Background App Warning**: Close prohibited background applications such as Discord, Teams, Slack, or screen capture software before opening the exam file.
5. **Session Timeout on Launch**: Complete pre-exam hardware checks in your regular browser before starting the secure browser profile.

## Status

**Current Implementation Status**: Implemented; real-device verification pending.

The server implements configuration generation, header validation, and token exchange. Automated simulated end-to-end test journeys pass in testing environments. Physical on-device validation with live proctored cohorts remains scheduled for subsequent pilot verification.
