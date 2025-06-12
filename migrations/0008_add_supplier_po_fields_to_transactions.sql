-- Migration: Add supplier and PO fields to transactions table
-- Date: 2025-06-12

-- Add supplier name, PO number, and rate fields for check-in transactions
ALTER TABLE transactions ADD COLUMN supplier_name TEXT;
ALTER TABLE transactions ADD COLUMN po_number TEXT;
ALTER TABLE transactions ADD COLUMN rate NUMERIC(10, 2);

-- Create indexes for the new fields
CREATE INDEX transactions_supplier_name_idx ON transactions(supplier_name);
CREATE INDEX transactions_po_number_idx ON transactions(po_number);
CREATE INDEX transactions_rate_idx ON transactions(rate);