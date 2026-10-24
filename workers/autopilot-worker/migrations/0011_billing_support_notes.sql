-- Add billing/support note fields for invoices and tickets
ALTER TABLE invoices ADD COLUMN notes TEXT;

ALTER TABLE tickets ADD COLUMN description TEXT;
