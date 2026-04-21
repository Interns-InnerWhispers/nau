-- ============================================================================
-- NAU Dashboard Multi-Tenant Database Schema
-- Creates the production schema used by the Express backend and dynamic pages.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS nau
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nau;

-- ============================================================================
-- CORE SYSTEM TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS colleges (
  college_id INT PRIMARY KEY AUTO_INCREMENT,
  college_name VARCHAR(255) NOT NULL UNIQUE,
  college_code VARCHAR(100) NOT NULL UNIQUE,
  founded_year INT,
  location VARCHAR(255),
  domain VARCHAR(255),
  admin_email VARCHAR(255),
  logo_url TEXT,
  settings_json JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_college_code (college_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
  role_id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  role_name VARCHAR(100) NOT NULL,
  permissions_json JSON,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
  UNIQUE KEY unique_role (college_id, role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  alt_email VARCHAR(255),
  alt_phone VARCHAR(30),
  course VARCHAR(100),
  department VARCHAR(100),
  role VARCHAR(100) DEFAULT 'member',
  avatar_url TEXT,
  bio TEXT,
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  last_login DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_per_college (college_id, email),
  INDEX idx_user_lookup (college_id, status, role),
  INDEX idx_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_logs (
  log_id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  user_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id INT,
  changes_json JSON,
  ip_address VARCHAR(45),
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_activity_logs_college (college_id, timestamp),
  INDEX idx_activity_logs_user (user_id, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ORGANIZATION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  org_id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  org_name VARCHAR(255) NOT NULL,
  org_type VARCHAR(100) DEFAULT 'Council',
  description TEXT,
  founded_date DATE,
  member_count INT DEFAULT 0,
  president_id INT,
  logo_url TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
  FOREIGN KEY (president_id) REFERENCES users(user_id) ON DELETE SET NULL,
  UNIQUE KEY unique_org_name_per_college (college_id, org_name),
  INDEX idx_org_college (college_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS org_members (
  member_id INT PRIMARY KEY AUTO_INCREMENT,
  org_id INT NOT NULL,
  user_id INT NOT NULL,
  role VARCHAR(100) DEFAULT 'Member',
  join_date DATE,
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE KEY unique_org_member (org_id, user_id),
  INDEX idx_org_member_status (org_id, status),
  INDEX idx_org_member_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meetings (
  meeting_id INT PRIMARY KEY AUTO_INCREMENT,
  org_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  meeting_type VARCHAR(100) DEFAULT 'General',
  agenda TEXT,
  meeting_date DATE NOT NULL,
  meeting_time TIME,
  location VARCHAR(255),
  duration_minutes INT,
  description TEXT,
  minutes_url TEXT,
  plan_url TEXT,
  status ENUM('planned', 'ongoing', 'completed', 'cancelled') DEFAULT 'planned',
  attendee_count INT DEFAULT 0,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_meeting_org_date (org_id, meeting_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meeting_attendance (
  attendance_id INT PRIMARY KEY AUTO_INCREMENT,
  meeting_id INT NOT NULL,
  user_id INT NOT NULL,
  attended BOOLEAN DEFAULT FALSE,
  check_in_time DATETIME,
  check_out_time DATETIME,
  FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE KEY unique_meeting_attendance (meeting_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ACTIVITY TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS activities (
  activity_id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT 'Other',
  description TEXT,
  objectives TEXT,
  strategic_pillar VARCHAR(100),
  mode VARCHAR(50) DEFAULT 'Offline',
  team VARCHAR(100),
  coordinator VARCHAR(255),
  start_date DATE,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  location VARCHAR(255),
  organizer_id INT,
  status ENUM('draft', 'scheduled', 'ongoing', 'completed', 'cancelled') DEFAULT 'draft',
  participant_count INT DEFAULT 0,
  expected_participants INT DEFAULT 0,
  budget DECIMAL(12, 2),
  report_url TEXT,
  reviewer_comment TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
  FOREIGN KEY (organizer_id) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_activity_college_date (college_id, start_date),
  INDEX idx_activity_status (college_id, status),
  INDEX idx_activity_category (college_id, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_participants (
  participant_id INT PRIMARY KEY AUTO_INCREMENT,
  activity_id INT NOT NULL,
  user_id INT NOT NULL,
  rsvp_status ENUM('pending', 'accepted', 'declined', 'attended') DEFAULT 'pending',
  attendance_confirmed BOOLEAN DEFAULT FALSE,
  hours_contributed DECIMAL(5, 2),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (activity_id) REFERENCES activities(activity_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE KEY unique_activity_participant (activity_id, user_id),
  INDEX idx_activity_participant_status (activity_id, rsvp_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_attachments (
  attachment_id INT PRIMARY KEY AUTO_INCREMENT,
  activity_id INT NOT NULL,
  file_name VARCHAR(255),
  file_url TEXT,
  file_type VARCHAR(100),
  uploaded_by INT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (activity_id) REFERENCES activities(activity_id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS events_proposed (
  proposal_id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  proposer_id INT NOT NULL,
  category VARCHAR(100),
  team VARCHAR(100),
  proposed_date DATE,
  duration_hours INT,
  location VARCHAR(255),
  expected_participants INT,
  budget_estimate DECIMAL(12, 2),
  objectives TEXT,
  risk_assessment TEXT,
  notes TEXT,
  document_url TEXT,
  status ENUM('draft', 'submitted', 'under-review', 'approved', 'rejected', 'scheduled') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  review_date DATETIME,
  reviewed_by INT,
  review_comments TEXT,
  FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
  FOREIGN KEY (proposer_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_proposals_college_status (college_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS celebrations (
  celebration_id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) DEFAULT 'Custom',
  celebration_date DATE,
  frequency VARCHAR(100) DEFAULT 'annual',
  budget DECIMAL(12, 2),
  theme VARCHAR(255),
  event_team VARCHAR(100),
  notes TEXT,
  content_status VARCHAR(100) DEFAULT 'not-started',
  linked_proposal_id INT,
  preset BOOLEAN DEFAULT FALSE,
  status ENUM('planned', 'confirmed', 'completed', 'cancelled') DEFAULT 'planned',
  assigned_coordinator INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_coordinator) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (linked_proposal_id) REFERENCES events_proposed(proposal_id) ON DELETE SET NULL,
  INDEX idx_celebrations_college_date (college_id, celebration_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS celebration_attendees (
  attendee_id INT PRIMARY KEY AUTO_INCREMENT,
  celebration_id INT NOT NULL,
  user_id INT NOT NULL,
  rsvp_status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
  confirmed_at DATETIME,
  FOREIGN KEY (celebration_id) REFERENCES celebrations(celebration_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE KEY unique_celebration_attendee (celebration_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS self_driven_activities (
  sda_id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  objectives TEXT,
  notes TEXT,
  mode VARCHAR(50) DEFAULT 'Offline',
  venue VARCHAR(255),
  team VARCHAR(100),
  coordinator VARCHAR(255),
  initiator_id INT NOT NULL,
  start_date DATE,
  end_date DATE,
  status ENUM('initiated', 'ongoing', 'completed', 'paused', 'cancelled') DEFAULT 'initiated',
  participant_count INT DEFAULT 0,
  estimated_hours INT,
  mentor_id INT,
  report_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
  FOREIGN KEY (initiator_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (mentor_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_sda_college_status (college_id, status),
  INDEX idx_sda_college_date (college_id, start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sda_participants (
  sda_participant_id INT PRIMARY KEY AUTO_INCREMENT,
  sda_id INT NOT NULL,
  user_id INT NOT NULL,
  role VARCHAR(100),
  hours_contributed DECIMAL(5, 2) DEFAULT 0,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sda_id) REFERENCES self_driven_activities(sda_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE KEY unique_sda_participant (sda_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- FINANCE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS budget_allocation (
  budget_id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  fiscal_year INT NOT NULL,
  category VARCHAR(100) NOT NULL,
  allocated_amount DECIMAL(12, 2) NOT NULL,
  used_amount DECIMAL(12, 2) DEFAULT 0,
  remaining_amount DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
  UNIQUE KEY unique_budget_category_year (college_id, fiscal_year, category),
  INDEX idx_budget_college_year (college_id, fiscal_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
  transaction_id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  type ENUM('Expense', 'Income') NOT NULL,
  category VARCHAR(100),
  amount DECIMAL(12, 2) NOT NULL,
  transaction_date DATE NOT NULL,
  payment_method VARCHAR(100),
  event_id INT,
  submitted_by INT NOT NULL,
  notes TEXT,
  status ENUM('draft', 'submitted', 'approved', 'rejected') DEFAULT 'draft',
  approval_by INT,
  approval_date DATETIME,
  approval_comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES activities(activity_id) ON DELETE SET NULL,
  FOREIGN KEY (submitted_by) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (approval_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_transactions_college_date (college_id, transaction_date),
  INDEX idx_transactions_status (college_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transaction_receipts (
  receipt_id INT PRIMARY KEY AUTO_INCREMENT,
  transaction_id INT NOT NULL,
  file_name VARCHAR(255),
  file_url TEXT,
  amount_verified BOOLEAN DEFAULT FALSE,
  uploaded_by INT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(user_id) ON DELETE SET NULL,
  UNIQUE KEY unique_transaction_receipt (transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expense_approvals (
  approval_id INT PRIMARY KEY AUTO_INCREMENT,
  transaction_id INT NOT NULL,
  approver_id INT NOT NULL,
  approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  approval_comments TEXT,
  submitted_date DATETIME,
  approved_date DATETIME,
  FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE CASCADE,
  FOREIGN KEY (approver_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_expense_approval_status (approval_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- REPORTING TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS reports (
  report_id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  activity_id INT,
  title VARCHAR(255) NOT NULL,
  report_type VARCHAR(100) DEFAULT 'Activity',
  period_start DATE,
  period_end DATE,
  file_url TEXT,
  actual_participants INT,
  version INT DEFAULT 1,
  submitted_by INT NOT NULL,
  submitted_date DATETIME,
  status ENUM('draft', 'submitted', 'reviewed', 'approved', 'rejected', 'resubmission-required') DEFAULT 'draft',
  reviewer_id INT,
  review_date DATETIME,
  review_comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
  FOREIGN KEY (activity_id) REFERENCES activities(activity_id) ON DELETE SET NULL,
  FOREIGN KEY (submitted_by) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_reports_college_status (college_id, status),
  INDEX idx_reports_college_type (college_id, report_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_content (
  content_id INT PRIMARY KEY AUTO_INCREMENT,
  report_id INT NOT NULL,
  summary TEXT,
  highlights TEXT,
  challenges TEXT,
  key_metrics TEXT,
  findings TEXT,
  recommendations TEXT,
  FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE,
  UNIQUE KEY unique_report_content (report_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SETTINGS / NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_settings (
  setting_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  email_notifications BOOLEAN DEFAULT TRUE,
  activity_updates BOOLEAN DEFAULT TRUE,
  budget_alerts BOOLEAN DEFAULT TRUE,
  event_reminders BOOLEAN DEFAULT TRUE,
  report_notifications BOOLEAN DEFAULT TRUE,
  theme ENUM('light', 'dark') DEFAULT 'light',
  language VARCHAR(50) DEFAULT 'en',
  timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_settings (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  notification_id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  user_id INT NOT NULL,
  title VARCHAR(255),
  message TEXT,
  type VARCHAR(50) DEFAULT 'info',
  related_entity_type VARCHAR(100),
  related_entity_id INT,
  read_status BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME,
  FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_notifications_user (user_id, read_status),
  INDEX idx_notifications_college (college_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dashboard_tasks (
  task_id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  due_date DATE NOT NULL,
  priority ENUM('High', 'Medium', 'Low') DEFAULT 'Medium',
  status ENUM('Pending', 'Completed') DEFAULT 'Pending',
  notes TEXT,
  assigned_to INT,
  created_by INT NOT NULL,
  completed_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_dashboard_tasks_college_due (college_id, due_date),
  INDEX idx_dashboard_tasks_college_status (college_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SOCIAL MEDIA
-- ============================================================================

CREATE TABLE IF NOT EXISTS social_media_posts (
  post_id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  platform VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  content TEXT,
  image_url TEXT,
  video_url TEXT,
  posted_date DATETIME,
  scheduled_date DATETIME,
  status ENUM('draft', 'posted', 'scheduled') DEFAULT 'draft',
  posted_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
  FOREIGN KEY (posted_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_social_posts_college_platform (college_id, platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_metrics (
  metric_id INT PRIMARY KEY AUTO_INCREMENT,
  post_id INT NOT NULL,
  likes INT DEFAULT 0,
  shares INT DEFAULT 0,
  comments INT DEFAULT 0,
  reach INT DEFAULT 0,
  impressions INT DEFAULT 0,
  engagement_rate DECIMAL(5, 2),
  saved_count INT DEFAULT 0,
  recorded_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES social_media_posts(post_id) ON DELETE CASCADE,
  INDEX idx_post_metrics_date (recorded_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS social_followers (
  follower_id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  platform VARCHAR(50) NOT NULL,
  follower_count INT DEFAULT 0,
  follower_growth INT DEFAULT 0,
  recorded_date DATE DEFAULT (CURRENT_DATE),
  FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
  INDEX idx_social_followers_college_platform (college_id, platform, recorded_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS social_media_accounts (
  account_id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  platform VARCHAR(50) NOT NULL,
  handle VARCHAR(255) NOT NULL,
  profile_link VARCHAR(255),
  followers INT DEFAULT 0,
  managed_by VARCHAR(100),
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
  UNIQUE KEY unique_social_handle (college_id, platform, handle)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS social_media_metrics (
  metric_id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  account_id INT NOT NULL,
  date DATE NOT NULL,
  followers INT DEFAULT 0,
  posts INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  engagement_rate DECIMAL(5, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES social_media_accounts(account_id) ON DELETE CASCADE,
  INDEX idx_social_metrics_account_date (account_id, date),
  INDEX idx_social_metrics_college_date (college_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TRAINING TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS training_programs (
  training_id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  course_name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_hours INT,
  completion_requirement INT DEFAULT 80,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_training_college (college_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_training_progress (
  progress_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  training_id INT NOT NULL,
  completion_percentage INT DEFAULT 0,
  completion_date DATETIME,
  status ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',
  enrolled_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (training_id) REFERENCES training_programs(training_id) ON DELETE CASCADE,
  UNIQUE KEY unique_training_progress (user_id, training_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
