# Lago product spec

## Current state

The first implementation uses the Stream design. Members register with an email, password and display name and wait for administrator approval. Approved members can post, edit and cancel events, invite people or groups, view guest responses, RSVP, and browse the monthly calendar. Administrators approve accounts and manage both groups. Members can update their profile and subscribe to a revocable private calendar URL.

New events use Europe/Zurich time. The feed shows newest posts first. Group invitations follow current membership and preserve a member’s last RSVP if they regain access. Cancelled events stay visible in Lago and are removed from the personal subscription. Profile notification preferences default to on. Email delivery and push permission and delivery are planned.

## Product requirements

**Goal.** Give the Lago friends group a private, mobile-first app to make plans, see who’s coming, and keep personal calendars up to date.

- **Registration and approval.** Anyone can register with email and password on Lago’s own login page, then set their display name. New accounts see a pending approval screen. Only accounts approved by the administrator can use the app. The display name is the member’s sole public name.
- **Profile and notifications.** Members can update their display name and profile photo. Email and push preferences are on by default and can be turned off independently. **Planned:** email and push delivery, with device permission required for push.
- **Create an event.** The host enters a title, date and time, with optional location, notes and a cover photo. They can invite individuals, **Lago Nostre**, **Lago Plus**, or any combination. Each person gets one invitation.
- **Group membership.** The administrator manages both groups. Changes apply automatically to already-posted events that invite the group. Newly added members gain access and see those events in their feed and Lago calendar. Removed members lose access and the events disappear from both views unless they’re also invited directly or through the other group.
- **Feed and RSVP.** Lago opens to a feed of events you’re invited to or hosting. Invitees can choose or change **Going**, **Maybe** or **Declined**. The host and all invitees can see the guest list and current responses.
- **Edits and cancellations.** Hosts can edit or cancel their events. The feed shows updated details or marks the event as cancelled. **Planned:** notify invited guests of edits and cancellations by email and push according to their settings.
- **Calendars.** Lago’s monthly view includes hosted events and all invitations, including declined ones. Members can subscribe to a private personal calendar link. The subscription includes hosted events and invitations marked **Going** or **Maybe**. Edits update entries. Cancellations, declines and loss of invitation access remove them when the personal calendar app next refreshes.

**Platform.** Mobile-first web app with home-screen installation on supported browsers. The app uses Vue with Vite, Fastify and PostgreSQL. Railway is configured with separate test and production environments, each with its own database.
