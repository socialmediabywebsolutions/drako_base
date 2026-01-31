-- Migration: 0075 - Ticket Messages Support
-- Purpose: Support threaded conversations on customer support tickets
-- Phase: Campamento Base Phase 3

CREATE TABLE IF NOT EXISTS ticket_messages (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    author_type TEXT NOT NULL CHECK(author_type IN ('OWNER', 'CUSTOMER', 'AGENT')),
    author_id TEXT,
    message TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    metadata_json TEXT,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created_at ON ticket_messages(created_at DESC);
