-- Instagram-style message requests: conversation status + folders (idempotent)
SET @exists := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'conversations' AND column_name = 'status');
SET @sql := IF(@exists = 0, 'ALTER TABLE conversations ADD COLUMN status ENUM(''accepted'',''pending'') NOT NULL DEFAULT ''accepted''', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @exists := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'conversations' AND column_name = 'requested_by');
SET @sql := IF(@exists = 0, 'ALTER TABLE conversations ADD COLUMN requested_by BIGINT UNSIGNED NULL', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @exists := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'conversations' AND column_name = 'folder');
SET @sql := IF(@exists = 0, 'ALTER TABLE conversations ADD COLUMN folder ENUM(''primary'',''general'') NOT NULL DEFAULT ''primary''', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
