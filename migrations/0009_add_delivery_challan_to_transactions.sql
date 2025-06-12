-- Add delivery_challan_number column to transactions table
ALTER TABLE transactions ADD COLUMN delivery_challan_number TEXT;

-- Update existing transactions to populate rate from cost where rate is null
UPDATE transactions 
SET rate = cost 
WHERE rate IS NULL AND cost IS NOT NULL;