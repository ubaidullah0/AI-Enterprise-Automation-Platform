DELETE FROM user_api_keys WHERE label='AI Platform';
INSERT INTO user_api_keys (id, "userId", label, "apiKey", "createdAt", "updatedAt") 
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '204e0adf-38a4-43d1-bb44-a948c2552128', 'AI Platform', 'n8n_api_aiplatform2026securekey', '2026-08-07T18:07:00.000Z', '2026-08-07T18:07:00.000Z');
