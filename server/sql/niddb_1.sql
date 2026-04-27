CREATE DATABASE IF NOT EXISTS niddb_1
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE niddb_1;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  wallet_balance INT NOT NULL DEFAULT 5,
  total_downloads INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS downloads (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_downloads_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  account_holder_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS packages (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  credits INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(16) NOT NULL DEFAULT 'ETB',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_requests (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  payment_method_id CHAR(36) NOT NULL,
  package_id CHAR(36) NULL,
  transaction_number VARCHAR(255) NOT NULL,
  amount INT NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'reversed') NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_requests_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_requests_method
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_requests_package
    FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS password_reset_otps (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  otp_code VARCHAR(16) NOT NULL,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_password_reset_otps_email (email)
);

INSERT INTO packages (id, name, credits, price, currency, is_active)
SELECT 'pkg-10-default', '10 PDFs - 200 ETB', 10, 200, 'ETB', 1
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = 'pkg-10-default');

INSERT INTO packages (id, name, credits, price, currency, is_active)
SELECT 'pkg-25-default', '25 PDFs - 450 ETB', 25, 450, 'ETB', 1
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE id = 'pkg-25-default');

INSERT INTO payment_methods (id, name, account_holder_name, account_number)
SELECT 'pm-cbe-default', 'Commercial Bank of Ethiopia', 'Demo Account', '1000000000'
WHERE NOT EXISTS (SELECT 1 FROM payment_methods WHERE id = 'pm-cbe-default');

INSERT INTO users (id, email, password_hash, name, role, wallet_balance, total_downloads)
SELECT
  '11111111-1111-1111-1111-111111111111',
  'admin@nconvert.local',
  '$2b$10$rk0Eo40pEZd2sQ3W1xn8C..OuddUCbsDuKY0ix2a3Ge6J7S90/dVa',
  'Admin User',
  'admin',
  0,
  3
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@nconvert.local');

INSERT INTO users (id, email, password_hash, name, role, wallet_balance, total_downloads)
SELECT
  '22222222-2222-2222-2222-222222222222',
  'user@nconvert.local',
  '$2b$10$6RNvLljkdk.bds808V4l7.kHsh3BTaOkxFrpLZmVNqppNqdD0xC4W',
  'Demo User',
  'user',
  12,
  1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'user@nconvert.local');

INSERT INTO downloads (id, user_id, file_name)
SELECT
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  'seeded-demo-download.png'
WHERE NOT EXISTS (SELECT 1 FROM downloads WHERE id = '33333333-3333-3333-3333-333333333333');

INSERT INTO payment_requests (id, user_id, payment_method_id, package_id, transaction_number, amount, status)
SELECT
  '44444444-4444-4444-4444-444444444444',
  '22222222-2222-2222-2222-222222222222',
  'pm-cbe-default',
  'pkg-10-default',
  'TXN-DEMO-1001',
  10,
  'pending'
WHERE NOT EXISTS (SELECT 1 FROM payment_requests WHERE id = '44444444-4444-4444-4444-444444444444');

-- Demo credentials
-- admin@nconvert.local / admin123
-- user@nconvert.local / user1234
