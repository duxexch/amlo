-- ═══════════════════════════════════════════════════════
-- Ablox — Full Database Cleanup
-- Deletes ALL data from ALL 35 tables
-- After running: docker restart ablox_app
-- ensureDefaultAdmin() will recreate admin/admin123
-- ═══════════════════════════════════════════════════════

BEGIN;

TRUNCATE TABLE
  gift_transactions,
  wallet_transactions,
  streams,
  stream_viewers,
  user_reports,
  user_follows,
  admin_logs,
  friendships,
  conversations,
  messages,
  calls,
  world_sessions,
  world_messages,
  world_pricing,
  chat_blocks,
  message_reports,
  upgrade_requests,
  user_profiles,
  friend_profile_visibility,
  featured_streams_config,
  announcement_popups,
  fraud_alerts,
  agent_applications,
  account_applications,
  notification_preferences,
  withdrawal_requests,
  agents,
  users,
  gifts,
  coin_packages,
  system_settings,
  system_config,
  payment_methods,
  banned_words,
  admins
CASCADE;

COMMIT;
