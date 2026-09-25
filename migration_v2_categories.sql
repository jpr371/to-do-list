USE taskflow_lite;

-- Use este arquivo somente para atualizar manualmente uma instalação anterior.
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS category VARCHAR(60) NULL AFTER description;

ALTER TABLE tasks
    ADD INDEX IF NOT EXISTS idx_tasks_user_category (user_id, category);
