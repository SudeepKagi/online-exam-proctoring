# Client Error Code & Next-Action Mapping

This reference defines the plain-English translations and recommended next actions for standard backend error codes.

| Backend Code | User-Facing Headline | Explanation & Next Action | Action Button |
| :--- | :--- | :--- | :--- |
| `TOKEN_EXPIRED` | Session expired | Your secure session has timed out. Please sign in again to continue. | Sign In |
| `ATTEMPT_ALREADY_EXISTS` | Exam already submitted | An attempt has already been completed or submitted for this examination. | View Results |
| `EXAM_NOT_OPEN` | Examination not yet started | The testing window for this exam has not opened yet. Check the schedule below. | Return to Dashboard |
| `EXAM_ENDED` | Examination window closed | The scheduled testing window has ended. Contact your instructor if you need assistance. | Return to Dashboard |
| `NETWORK_DISCONNECTED` | Connection interrupted | Your answers are safely preserved locally. We will automatically reconnect when connectivity returns. | Retry Connection |
| `TOKEN_ALREADY_USED` | Launch link already used | This launch link has already been redeemed. Return to your main browser to get a fresh link or sign in with your password. | Sign In |
| `INTERNAL_ERROR` | Temporary service issue | Our servers encountered a temporary issue. Please try again in a few moments. | Retry |
