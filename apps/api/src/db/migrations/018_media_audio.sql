-- Story upload: add audio kind (music stories) — 2026-10-09
ALTER TABLE media_objects MODIFY kind ENUM('image','video','audio') NOT NULL;
ALTER TABLE stories ADD COLUMN media_type ENUM('photo','video','music') NULL AFTER media_url;
