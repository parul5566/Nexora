CREATE TABLE IF NOT EXISTS media_objects (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('image','video') NOT NULL,
  mime VARCHAR(100) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NULL,
  storage_path VARCHAR(500) NOT NULL,
  variants JSON NULL,
  status ENUM('pending','ready','failed') NOT NULL DEFAULT 'pending',
  error_message VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_media_owner (owner_id),
  CONSTRAINT fk_media_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- migrate legacy avatar uploads into the media store (idempotent-ish: only rows created before this module are ignored; they still serve from disk)
