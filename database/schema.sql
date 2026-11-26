-- HostelHub schema (PostgreSQL 13+). Idempotent: safe to run more than once.
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  student_id VARCHAR(40) NOT NULL UNIQUE,
  email VARCHAR(190) UNIQUE,
  phone VARCHAR(20) UNIQUE,
  college VARCHAR(150),
  department VARCHAR(120),
  academic_year VARCHAR(20),
  hostel_name VARCHAR(120),
  hostel_block VARCHAR(20),
  flat_number VARCHAR(20),
  room_number VARCHAR(20),
  skills TEXT[] NOT NULL DEFAULT '{}',
  interests TEXT[] NOT NULL DEFAULT '{}',
  role VARCHAR(10) NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  theme VARCHAR(20) NOT NULL DEFAULT 'classic' CHECK (theme IN ('classic','decent','simple','normal')),
  show_email BOOLEAN NOT NULL DEFAULT FALSE,
  show_phone BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS otp_verifications (
  id SERIAL PRIMARY KEY,
  identifier VARCHAR(190) NOT NULL,
  otp_hash VARCHAR(128) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_identifier ON otp_verifications(identifier, created_at DESC);

CREATE TABLE IF NOT EXISTS flats (
  id SERIAL PRIMARY KEY,
  block_name VARCHAR(20) NOT NULL,
  flat_number VARCHAR(20) NOT NULL,
  floor_number INT NOT NULL,
  total_rooms INT NOT NULL DEFAULT 1,
  balcony_available BOOLEAN NOT NULL DEFAULT FALSE,
  balcony_direction VARCHAR(12) CHECK (balcony_direction IN ('North','South','East','West','North-East','North-West','South-East','South-West')),
  kitchen VARCHAR(10) NOT NULL DEFAULT 'None' CHECK (kitchen IN ('None','Shared','Private')),
  bathroom_type VARCHAR(10) NOT NULL DEFAULT 'Common' CHECK (bathroom_type IN ('Common','Attached','Mixed')),
  bathroom_details TEXT,
  facilities TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  UNIQUE (block_name, flat_number)
);
CREATE INDEX IF NOT EXISTS idx_flats_block_floor ON flats(block_name, floor_number);

CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  flat_id INT NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
  room_number VARCHAR(20) NOT NULL,
  room_type VARCHAR(30) NOT NULL DEFAULT 'Shared',
  capacity INT NOT NULL CHECK (capacity > 0),
  available_beds INT NOT NULL CHECK (available_beds >= 0),
  window_direction VARCHAR(12),
  attached_bathroom BOOLEAN NOT NULL DEFAULT FALSE,
  facilities TEXT[] NOT NULL DEFAULT '{}',
  semester VARCHAR(30) NOT NULL,
  availability_status VARCHAR(12) NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available','full','blocked')),
  description TEXT,
  UNIQUE (flat_id, room_number, semester),
  CHECK (available_beds <= capacity)
);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(availability_status, semester);

CREATE TABLE IF NOT EXISTS room_allocations (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id INT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  semester VARCHAR(30) NOT NULL,
  allocation_status VARCHAR(12) NOT NULL DEFAULT 'requested' CHECK (allocation_status IN ('requested','allocated','rejected','cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  allocated_at TIMESTAMPTZ
);
-- A student can hold only one open (requested/allocated) entry per semester => no double booking per student.
CREATE UNIQUE INDEX IF NOT EXISTS uq_alloc_user_semester_open ON room_allocations(user_id, semester) WHERE allocation_status IN ('requested','allocated');

CREATE TABLE IF NOT EXISTS play_requests (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_name VARCHAR(60) NOT NULL,
  play_date DATE NOT NULL,
  play_time TIME NOT NULL,
  location VARCHAR(120) NOT NULL,
  players_required INT NOT NULL CHECK (players_required BETWEEN 1 AND 20),
  description TEXT,
  status VARCHAR(12) NOT NULL DEFAULT 'open' CHECK (status IN ('open','full','cancelled','completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_play_status_date ON play_requests(status, play_date);

CREATE TABLE IF NOT EXISTS play_participants (
  id SERIAL PRIMARY KEY,
  play_request_id INT NOT NULL REFERENCES play_requests(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (play_request_id, user_id)
);

CREATE TABLE IF NOT EXISTS marketplace_items (
  id SERIAL PRIMARY KEY,
  seller_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(140) NOT NULL,
  category VARCHAR(40) NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  condition VARCHAR(20) NOT NULL CHECK (condition IN ('New','Like New','Good','Fair','Poor')),
  pickup_location VARCHAR(120) NOT NULL,
  image_url TEXT,
  status VARCHAR(10) NOT NULL DEFAULT 'available' CHECK (status IN ('available','sold','removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_market_status_cat ON marketplace_items(status, category);

CREATE TABLE IF NOT EXISTS hostel_needs (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_name VARCHAR(120) NOT NULL,
  category VARCHAR(40) NOT NULL,
  request_type VARCHAR(10) NOT NULL CHECK (request_type IN ('borrow','buy')),
  required_date DATE NOT NULL,
  duration VARCHAR(60),
  location VARCHAR(120),
  description TEXT,
  status VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open','fulfilled','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_needs_status ON hostel_needs(status, required_date);

CREATE TABLE IF NOT EXISTS need_responses (
  id SERIAL PRIMARY KEY,
  need_id INT NOT NULL REFERENCES hostel_needs(id) ON DELETE CASCADE,
  responder_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response_message TEXT,
  response_type VARCHAR(10) NOT NULL CHECK (response_type IN ('offer','interest','reaction')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (need_id, responder_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  creator_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  domain VARCHAR(60) NOT NULL,
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  technologies TEXT[] NOT NULL DEFAULT '{}',
  teammates_needed INT NOT NULL CHECK (teammates_needed >= 1),
  current_team_size INT NOT NULL DEFAULT 1 CHECK (current_team_size >= 1),
  deadline DATE,
  project_type VARCHAR(20) NOT NULL CHECK (project_type IN ('academic','hackathon','research','personal')),
  status VARCHAR(12) NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_projects_status_domain ON projects(status, domain);

CREATE TABLE IF NOT EXISTS project_interests (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  reporter_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('marketplace','play','need','project','user')),
  target_id INT NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
