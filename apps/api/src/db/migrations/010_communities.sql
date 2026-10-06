-- Module 14: Communities
CREATE TABLE IF NOT EXISTS communities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  description TEXT NULL,
  privacy ENUM('public','private') NOT NULL DEFAULT 'public',
  rules JSON NULL,
  creator_id BIGINT UNSIGNED NOT NULL,
  member_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_communities_privacy (privacy),
  CONSTRAINT fk_communities_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS community_members (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  community_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role ENUM('owner','admin','moderator','member') NOT NULL DEFAULT 'member',
  invited_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_community_member (community_id, user_id),
  CONSTRAINT fk_cmem_community FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE,
  CONSTRAINT fk_cmem_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS community_invites (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  community_id BIGINT UNSIGNED NOT NULL,
  inviter_id BIGINT UNSIGNED NOT NULL,
  invitee_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_community_invite (community_id, invitee_id, status),
  CONSTRAINT fk_cinv_community FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE,
  CONSTRAINT fk_cinv_inviter FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cinv_invitee FOREIGN KEY (invitee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE posts
  ADD COLUMN community_id BIGINT UNSIGNED NULL AFTER author_id,
  ADD COLUMN pinned_at TIMESTAMP NULL DEFAULT NULL AFTER community_id,
  ADD INDEX idx_posts_community (community_id);
