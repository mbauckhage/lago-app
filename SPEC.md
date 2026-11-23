# Lago Nostre product spec

## Current state

The app is called Lago Nostre. It uses the dark Stream design with a text-only wordmark and a Swiss Standard German interface. The app icon’s red highlights primary actions and selected replies. Its deep blue marks pending invitations, avatar initials and active navigation. Members register with an email, password and display name and wait for administrator approval. Approved members can post, edit and cancel events, invite people or groups, view guest responses, RSVP, and browse the monthly calendar. Administrators approve accounts and manage both groups. Members can update their profile and subscribe to a revocable private calendar URL.

New events use Europe/Zurich time. The feed shows newest posts first. Group invitations follow current membership and preserve a member’s last RSVP if they regain access. Cancelled events stay visible in Lago and are removed from the personal subscription. Profile notification preferences default to on. Push delivery supports invitations, event edits and cancellations on subscribed devices; email delivery remains planned.

## Product requirements

**Goal.** Give the Lago friends group a private, mobile-first app to make plans, see who’s coming, and keep personal calendars up to date.

- **Registration and approval.** Anyone can register with email and password on Lago’s own login page, then set their display name. New accounts see a pending approval screen. Only accounts approved by the administrator can use the app. The display name is the member’s sole public name.
- **Profile and notifications.** Members can update their display name and profile photo. Email and push preferences are on by default and can be turned off independently. Members enable each device explicitly in Profile. Push requires HTTPS, browser permission and, on iOS/iPadOS 16.4+, installation and launch from the Home Screen. Denied or unsupported devices show instructions. Turning off the saved push preference silences all devices; disabling a device removes its subscription. Signing out disconnects that device. Notifications open the relevant event after sign-in. Delivery is queued with bounded retries and expired subscriptions are removed. **Planned:** email delivery.
- **Create an event.** The host enters a title, date and time, with optional location, notes and a cover photo. They can invite individuals, **Lago Nostre**, **Lago Plus**, or any combination. Each person gets one invitation.
- **Group membership.** The administrator manages both groups. Changes apply automatically to already-posted events that invite the group. Newly added members gain access and see those events in their feed and Lago calendar. Removed members lose access and the events disappear from both views unless they’re also invited directly or through the other group.
- **Feed and RSVP.** Lago opens to a feed of events you’re invited to or hosting. Invitees can choose or change **Going**, **Maybe** or **Declined**. The host and all invitees can see the guest list and current responses.
- **Edits and cancellations.** Hosts can edit or cancel their events. The feed shows updated details or marks the event as cancelled. Notify current invited guests of edits and cancellations by push according to their saved settings and device subscriptions. **Planned:** email notifications.
- **Calendars.** Lago’s monthly view includes hosted events and all invitations, including declined ones. Members can subscribe to a private personal calendar link. The subscription includes hosted events and invitations marked **Going** or **Maybe**. Edits update entries. Cancellations, declines and loss of invitation access remove them when the personal calendar app next refreshes.

**Platform.** Mobile-first web app with home-screen installation on supported browsers. The app uses Vue with Vite, Fastify and PostgreSQL. Railway is configured with separate test and production environments, each with its own database.

The home-screen icon and browser favicon use the classic Lago wordmark in poppy red on deep blue. Home-screen installation uses the PNG icons in the web app manifest or the Apple touch icon on iOS.

The header reserves the device’s top safe area in addition to its normal height and padding. Installed standalone apps add another 16px of top clearance so the title and actions sit below the iOS system status-bar blur. The clearance stays within the app viewport, preserving the bottom navigation and scrollable content area.

## Local development

`./start.sh` starts the checkout’s local PostgreSQL database when present, using its matching major version from `PATH` or a standard Homebrew installation. It reports a missing matching version or displays the database log on startup failure. The database stays running when the API and frontend stop.

## Frontend implementation

The event editor’s title image field uses a full-width dotted-outline image selector with a centred image icon. Clicking it or activating its file input with the keyboard opens the image picker. Selected images appear as a preview with an option to choose another image; existing covers are previewed when editing.

Event covers and profile photos accept JPEG, PNG and WebP files. Before saving, the browser converts files larger than 1 MiB to WebP, reducing the longest edge to at most 1920 pixels, then lowering quality and dimensions until the result fits within 1 MiB. Browsers without WebP encoding use PNG and reduce dimensions instead. Smaller files remain unchanged. Aspect ratio and transparency are preserved. Unreadable or unconvertible images show an error without saving the form; the server continues enforcing its image payload limit.

The Vue interface uses Tailwind CSS through its Vite plugin, with shared theme tokens and reusable UI components for buttons, navigation tabs, avatars and form fields. Event cards and RSVP controls compose these primitives. This structural refactor preserves the Stream layout, Swiss German copy, responsive sheets and existing product behavior.

## Push operations

Web Push VAPID keys are generated once and stored in PostgreSQL, independently in each environment. Preserve `push_config` across deploys to keep existing device subscriptions valid. Set `WEB_PUSH_SUBJECT` to a monitored `mailto:` contact (default `mailto:admin@lagonostre.ch`). The API processes the persistent notification queue every five seconds. Delivery is best effort; temporary failures retry up to four times and may produce duplicates on devices that already received a multi-device delivery. Group membership changes update access but do not send push notifications.
