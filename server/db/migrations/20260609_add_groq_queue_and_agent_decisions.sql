-- Phase 9b Migration: Add Groq Queue and Agent Decision Logging
-- Date: 2026-06-09
-- Purpose: Central queue for rate-limited Groq API requests + logging for decisions

-- Queue table for rate-limited Groq requests
CREATE TABLE IF NOT EXISTS groq_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type VARCHAR NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'pending',
  response JSONB,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_groq_queue_status ON groq_queue(status);
CREATE INDEX IF NOT EXISTS idx_groq_queue_created ON groq_queue(created_at);

-- Decision logging table
CREATE TABLE IF NOT EXISTS agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  agent_type VARCHAR NOT NULL,
  coach_id INT NOT NULL,
  task_id INT NOT NULL,
  groq_recommendation VARCHAR,
  groq_confidence DECIMAL(3,2),
  groq_reasoning TEXT,
  final_action VARCHAR,
  override_reason VARCHAR,
  overridden BOOLEAN DEFAULT FALSE,
  coach_pattern VARCHAR,
  task_status VARCHAR,
  metadata JSONB,
  FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_decisions_coach ON agent_decisions(coach_id);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_task ON agent_decisions(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_agent ON agent_decisions(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_timestamp ON agent_decisions(timestamp);
