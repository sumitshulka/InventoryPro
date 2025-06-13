-- Add return and disposal tracking fields to transfers table
ALTER TABLE transfers ADD COLUMN return_reason TEXT;
ALTER TABLE transfers ADD COLUMN return_courier_name VARCHAR(255);
ALTER TABLE transfers ADD COLUMN return_tracking_number VARCHAR(255);
ALTER TABLE transfers ADD COLUMN return_shipped_date TIMESTAMP;
ALTER TABLE transfers ADD COLUMN return_delivered_date TIMESTAMP;
ALTER TABLE transfers ADD COLUMN disposal_reason TEXT;
ALTER TABLE transfers ADD COLUMN disposal_date TIMESTAMP;