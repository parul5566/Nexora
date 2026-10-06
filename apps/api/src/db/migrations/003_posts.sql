-- 003_posts.sql — posts + media, polls, hashtags, mentions, bookmarks
CREATE TABLE IF NOT EXISTS posts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  author_id BIGINT UNSIGNED NOT NULL,
  community_id BIGINT UNSIGNED NULL,
  company_id BIGINT UNSIGNED NULL,
  pinned_at TIMESTAMP NULL DEFAULT NULL,
  type ENUM('text','image','video','link','poll') NOT NULL DEFAULT 'text',
  content TEXT NULL,
  visibility ENUM('public','followers','private') NOT NULL DEFAULT 'public',
  link_url VARCHAR(500) NULL,
  edited_at TIMESTAMP NULL DEFAULT NULL,
  is_draft TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_posts_author (author_id, created_at),
  KEY idx_posts_created (created_at),
  KEY idx_posts_community (community_id),
  KEY idx_posts_company (company_id),
  KEY idx_posts_author_cursor (author_id, id DESC),
  KEY idx_posts_visibility_draft (visibility, is_draft, id DESC),
  CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS post_media (
  post_id BIGINT UNSIGNED NOT NULL,
  media_url VARCHAR(500) NOT NULL,
  media_kind ENUM('image','video') NOT NULL DEFAULT 'image',
  PRIMARY KEY (post_id, media_url),
  CONSTRAINT fk_pm_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS polls (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT UNSIGNED NOT NULL,
  question VARCHAR(300) NULL,
  KEY polls_post (post_id),
  CONSTRAINT fk_polls_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS poll_options (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  poll_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(120) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_po_poll FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id BIGINT UNSIGNED NOT NULL,
  option_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (poll_id, user_id),
  CONSTRAINT fk_pv_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hashtags (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tag VARCHAR(100) NOT NULL,
  KEY hashtags_tag (tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS post_hashtags (
  post_id BIGINT UNSIGNED NOT NULL,
  hashtag_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (post_id, hashtag_id),
  CONSTRAINT fk_ph_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_ph_tag FOREIGN KEY (hashtag_id) REFERENCES hashtags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS post_mentions (
  post_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (post_id, user_id),
  CONSTRAINT fk_pmn_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_pmn_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id BIGINT UNSIGNED NOT NULL,
  post_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, post_id),
  CONSTRAINT fk_bm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_bm_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
