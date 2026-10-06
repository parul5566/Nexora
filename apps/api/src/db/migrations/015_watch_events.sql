-- Module 19: Creator analytics — real watch events
CREATE TABLE IF NOT EXISTS reel_watch_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reel_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  seconds INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_watch_reel (reel_id),
  INDEX idx_watch_time (created_at),
  CONSTRAINT fk_watch_reel FOREIGN KEY (reel_id) REFERENCES reels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
