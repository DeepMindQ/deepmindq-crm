# Task 4-a: Email & Real-time Agent

## Files Created

### 1. `src/lib/event-bus.ts`
- Simple in-memory event bus for SSE and inter-module communication
- Methods: `on()`, `emit()`, `removeAll()`, `listenerCount()`
- Thread-safe listener iteration (copies Set before iterating)
- Singleton `eventBus` export

### 2. `src/lib/email-sender.ts`
- Nodemailer wrapper with graceful demo mode
- `sendEmail(options)` — single email send; returns `{ success, messageId?, error? }`
- `sendBulkEmails(emails, delayMs)` — rate-limited bulk send
- Falls back to console logging when `SMTP_HOST` env var is not set

### 3. `src/lib/email-tracking.ts`
- In-memory tracking store (demo mode; production would use DB)
- `registerTrackingEvent(eventId, contactId, draftId)` — called by send route
- `recordTrackingEvent(eventId, event)` — called by track route on open/click
- `getTrackingRecord(eventId)` — retrieve tracking data for analytics

### 4. `src/app/api/emails/send/route.ts`
- POST endpoint: send email from draft or directly
- Zod validation: union of `{ draftId }` or `{ to, subject, body, contactId? }`
- Injects click tracking (rewrites `href` attributes) and open tracking pixel
- Calls `sendEmail()`, updates draft status to 'sent', updates contact's `lastContactedAt`
- Creates `TimelineEntry` and `Notification` in DB
- Emits notification via `eventBus` for SSE delivery

### 5. `src/app/api/emails/track/route.ts`
- GET endpoint for email tracking
- `?eid=xxx&type=open` → records open event, returns 1×1 transparent GIF
- `?eid=xxx&type=click&url=xxx` → records click event, 302 redirects to target URL
- Validates redirect URLs (http/https only)
- Emits `email_opened` and `email_clicked` events via `eventBus`

### 6. `src/app/api/realtime/route.ts`
- SSE (Server-Sent Events) endpoint
- Subscribes to `notification`, `email_opened`, `email_clicked` events from event bus
- Sends `connected` event on connection, `heartbeat` every 30 seconds
- Proper cleanup on client disconnect
- Sets appropriate headers (text/event-stream, no-cache, keep-alive)

### 7. `src/hooks/use-realtime.ts`
- React hook for consuming SSE events
- Returns: `{ connected, notifications, emailOpens, emailClicks, clear }`
- Auto-reconnects with 3-second delay on connection error
- Capped at 100 events per category
- Proper cleanup on unmount

## Build Verification
- All new files pass TypeScript type checking
- All new files pass ESLint (no new warnings/errors)
- Pre-existing TS errors remain in 7 other files (not introduced by this task)