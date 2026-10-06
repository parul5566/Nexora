CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NULL,
  type ENUM('reaction','comment','reply','follow','connection_request','connection_accept','mention') NOT NULL,
  payload JSON NULL,
  read_at TIMESTAMP NULL,
  dedupe_key VARCHAR(191) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user (user_id, created_at),
  INDEX idx_notif_unread (user_id, read_at),
  UNIQUE KEY uq_dedupe (dedupe_key),
  CONSTRAINT fk_nt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_nt_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
