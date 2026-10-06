CREATE TABLE IF NOT EXISTS stories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  author_id BIGINT UNSIGNED NOT NULL,
  media_url VARCHAR(500) NULL,
  bg_text VARCHAR(280) NULL,
  bg_color VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP NULL,
  INDEX idx_stories_author (author_id, expires_at),
  INDEX idx_stories_expiry (expires_at),
  CONSTRAINT fk_st_user FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS story_views (
  story_id BIGINT UNSIGNED NOT NULL,
  viewer_id BIGINT UNSIGNED NOT NULL,
  viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (story_id, viewer_id),
  CONSTRAINT fk_sv_story FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
  CONSTRAINT fk_sv_user FOREIGN KEY (viewer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- expire old stories periodically (event may not be enabled; queries also filter by expires_at)
CREATE INDEX idx_stories_exp2 ON stories (deleted_at, expires_at);
