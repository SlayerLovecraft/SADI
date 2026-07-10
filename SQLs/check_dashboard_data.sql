-- Check table structure and sample data
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'campaigns';

SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'interactions';

-- Check distinct status values
SELECT DISTINCT estado FROM campaigns;
SELECT DISTINCT estado FROM interactions;

-- Check sample data
SELECT * FROM campaigns LIMIT 3;
SELECT * FROM interactions LIMIT 3;
