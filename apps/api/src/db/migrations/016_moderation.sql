-- Module 20: Moderation
ALTER TABLE users
  ADD COLUMN status ENUM('active','restricted','suspended','banned') NOT NULL DEFAULT 'active';

CREATE TABLE IF NOT EXISTS reports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reporter_id BIGINT UNSIGNED NOT NULL,
  object_type ENUM('post','comment','user','community','job','message','reel','story') NOT NULL,
  object_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(500) NOT NULL,
  status ENUM('open','resolved','dismissed') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reports_status (status),
  INDEX idx_reports_object (object_type, object_id),
  CONSTRAINT fk_rep_user FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS moderation_actions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  moderator_id BIGINT UNSIGNED NOT NULL,
  report_id BIGINT UNSIGNED NULL,
  action ENUM('remove_content','restore_content','warn','restrict','suspend','ban','unban','dismiss') NOT NULL,
  object_type VARCHAR(30) NULL,
  object_id BIGINT UNSIGNED NULL,
  target_user_id BIGINT UNSIGNED NULL,
  note VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mod_actions_time (created_at),
  CONSTRAINT fk_mod_mod FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  role ENUM('moderator','admin') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
