USE itemgo;

CREATE OR REPLACE VIEW loan_records_readable AS
SELECT
  id AS record_id,
  JSON_UNQUOTE(JSON_EXTRACT(data, '$.asset_code')) AS asset_code,
  JSON_UNQUOTE(JSON_EXTRACT(data, '$.asset_name')) AS asset_name,
  JSON_UNQUOTE(JSON_EXTRACT(data, '$.borrower_name')) AS borrower_name,
  JSON_UNQUOTE(JSON_EXTRACT(data, '$.borrower_department')) AS borrower_department,
  JSON_UNQUOTE(JSON_EXTRACT(data, '$.borrower_building')) AS borrower_building,
  CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.quantity')) AS UNSIGNED) AS quantity,
  JSON_UNQUOTE(JSON_EXTRACT(data, '$.borrow_date')) AS borrow_date,
  JSON_UNQUOTE(JSON_EXTRACT(data, '$.due_date')) AS due_date,
  JSON_UNQUOTE(JSON_EXTRACT(data, '$.return_request_date')) AS return_request_date,
  JSON_UNQUOTE(JSON_EXTRACT(data, '$.return_date')) AS return_date,
  JSON_UNQUOTE(JSON_EXTRACT(data, '$.status')) AS status,
  created_at,
  updated_at
FROM entity_records
WHERE entity_name = 'LoanRecord';