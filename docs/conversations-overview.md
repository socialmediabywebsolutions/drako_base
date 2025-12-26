# Conversations Overview

## Purpose
Conversations unifies inbound emails and messages into a single inbox for owners and staff.

## Core Flow
- Email Intake receives a new message.
- `applyEmailAutomations` ensures a conversation is created for the email.
- A notification is generated and linked to the conversation.

## Key Helpers
- `ensureConversationForEmail` creates or reuses a conversation for an email.
- `createNotificationsForEmailConversation` notifies owners/staff about the email thread.

## UI Surfaces
- `/saas/[id]`: Conversations section with inbox + thread viewer.
- `/staff/[employeeId]`: Staff inbox block for assigned conversations.

## APIs
- `GET /api/conversations` (actor-filtered list)
- `GET /api/conversations/[id]/messages` (thread detail)
- `POST /api/conversations/[id]/messages` (reply)
- `GET /api/notifications` (notification list)

## Metadata Notes
Email messages store `conversationId` in metadata after the conversation is created.
This prevents duplicate notifications on subsequent automation runs.
