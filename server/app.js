import cors from "cors";
import express from "express";
import crypto from "node:crypto";
import { config } from "./config.js";
import { authMiddleware, hashPassword, requireAdmin, signToken, verifyPassword } from "./auth.js";
import { query, withTransaction } from "./db.js";

const app = express();

app.use(
  cors({
    origin: config.clientOrigin,
  }),
);
app.use(express.json({ limit: "2mb" }));

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    wallet_balance: Number(user.wallet_balance ?? 0),
    total_downloads: Number(user.total_downloads ?? 0),
    created_at: user.created_at,
  };
}

function isValidRole(role) {
  return role === "admin" || role === "user";
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const existing = await query("SELECT id FROM users WHERE email = ?", [email]);
  if (existing.length > 0) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const passwordHash = await hashPassword(password);
  const userId = crypto.randomUUID();

  await query(
    `INSERT INTO users (
      id, email, password_hash, name, role, wallet_balance, total_downloads
    ) VALUES (?, ?, ?, ?, 'user', ?, 0)`,
    [userId, email, passwordHash, name, config.walletStartingBalance],
  );

  res.status(201).json({ success: true });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const rows = await query(
    `SELECT id, email, password_hash, name, role, wallet_balance, total_downloads, created_at
     FROM users
     WHERE email = ?`,
    [email],
  );
  const user = rows[0];

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = signToken(user);
  res.json({ token, user: sanitizeUser(user) });
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

app.post("/api/auth/forgot-password/send", async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  const users = await query("SELECT id FROM users WHERE email = ?", [email]);
  if (users.length === 0) {
    return res.json({ success: true });
  }

  await query(
    "UPDATE password_reset_otps SET used = 1 WHERE email = ? AND used = 0",
    [email],
  );

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + config.otpTtlMinutes * 60_000);

  await query(
    "INSERT INTO password_reset_otps (id, email, otp_code, expires_at, used) VALUES (?, ?, ?, ?, 0)",
    [crypto.randomUUID(), email, otp, expiresAt],
  );

  res.json({
    success: true,
    otp,
    message: "OTP generated. Replace this with email delivery for production.",
  });
});

app.post("/api/auth/forgot-password/reset", async (req, res) => {
  const { email, otp, newPassword } = req.body ?? {};
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: "All fields are required." });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const otpRows = await query(
    `SELECT id
     FROM password_reset_otps
     WHERE email = ? AND otp_code = ? AND used = 0 AND expires_at >= NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [email, otp],
  );
  const otpRecord = otpRows[0];

  if (!otpRecord) {
    return res.status(400).json({ error: "Invalid or expired OTP." });
  }

  const users = await query("SELECT id FROM users WHERE email = ?", [email]);
  const user = users[0];

  if (!user) {
    return res.status(400).json({ error: "User not found." });
  }

  const passwordHash = await hashPassword(newPassword);

  await withTransaction(async (connection) => {
    await connection.execute(
      "UPDATE password_reset_otps SET used = 1 WHERE id = ?",
      [otpRecord.id],
    );
    await connection.execute(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [passwordHash, user.id],
    );
  });

  res.json({ success: true });
});

app.get("/api/dashboard", authMiddleware, async (req, res) => {
  const [downloadCountRows] = await Promise.all([
    query(
      "SELECT COUNT(*) AS count FROM downloads WHERE user_id = ?",
      [req.user.id],
    ),
  ]);

  res.json({
    profile: sanitizeUser(req.user),
    downloadCount: Number(downloadCountRows[0]?.count ?? 0),
  });
});

app.get("/api/packages", authMiddleware, async (req, res) => {
  const sql =
    req.user.role === "admin"
      ? "SELECT * FROM packages ORDER BY credits ASC"
      : "SELECT * FROM packages WHERE is_active = 1 ORDER BY credits ASC";
  const rows = await query(sql);
  res.json({ packages: rows });
});

app.post("/api/packages", authMiddleware, requireAdmin, async (req, res) => {
  const { name, credits, price, currency, is_active } = req.body ?? {};
  await query(
    `INSERT INTO packages (id, name, credits, price, currency, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), name, credits, price, currency, is_active ? 1 : 0],
  );
  res.status(201).json({ success: true });
});

app.patch("/api/packages/:id", authMiddleware, requireAdmin, async (req, res) => {
  const { name, credits, price, currency, is_active } = req.body ?? {};
  await query(
    `UPDATE packages
     SET name = ?, credits = ?, price = ?, currency = ?, is_active = ?
     WHERE id = ?`,
    [name, credits, price, currency, is_active ? 1 : 0, req.params.id],
  );
  res.json({ success: true });
});

app.delete("/api/packages/:id", authMiddleware, requireAdmin, async (req, res) => {
  await query("DELETE FROM packages WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

app.get("/api/payment-methods", authMiddleware, async (_req, res) => {
  const rows = await query(
    "SELECT * FROM payment_methods ORDER BY created_at DESC",
  );
  res.json({ paymentMethods: rows });
});

app.post("/api/payment-methods", authMiddleware, requireAdmin, async (req, res) => {
  const { name, account_holder_name, account_number } = req.body ?? {};
  await query(
    `INSERT INTO payment_methods (id, name, account_holder_name, account_number)
     VALUES (?, ?, ?, ?)`,
    [crypto.randomUUID(), name, account_holder_name, account_number],
  );
  res.status(201).json({ success: true });
});

app.patch("/api/payment-methods/:id", authMiddleware, requireAdmin, async (req, res) => {
  const { name, account_holder_name, account_number } = req.body ?? {};
  await query(
    `UPDATE payment_methods
     SET name = ?, account_holder_name = ?, account_number = ?
     WHERE id = ?`,
    [name, account_holder_name, account_number, req.params.id],
  );
  res.json({ success: true });
});

app.delete("/api/payment-methods/:id", authMiddleware, requireAdmin, async (req, res) => {
  await query("DELETE FROM payment_methods WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

app.get("/api/payment-requests", authMiddleware, async (req, res) => {
  const rows = await query(
    req.user.role === "admin"
      ? `SELECT pr.*, u.name AS user_name, u.email AS user_email, pm.name AS payment_method_name
         FROM payment_requests pr
         JOIN users u ON u.id = pr.user_id
         JOIN payment_methods pm ON pm.id = pr.payment_method_id
         ORDER BY pr.created_at DESC`
      : `SELECT pr.*, u.name AS user_name, u.email AS user_email, pm.name AS payment_method_name
         FROM payment_requests pr
         JOIN users u ON u.id = pr.user_id
         JOIN payment_methods pm ON pm.id = pr.payment_method_id
         WHERE pr.user_id = ?
         ORDER BY pr.created_at DESC`,
    req.user.role === "admin" ? [] : [req.user.id],
  );
  res.json({ paymentRequests: rows });
});

app.post("/api/payment-requests", authMiddleware, async (req, res) => {
  const { payment_method_id, package_id, transaction_number, amount } = req.body ?? {};
  await query(
    `INSERT INTO payment_requests (
      id, user_id, payment_method_id, package_id, transaction_number, amount, status
     ) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [
      crypto.randomUUID(),
      req.user.id,
      payment_method_id,
      package_id ?? null,
      transaction_number,
      amount,
    ],
  );
  res.status(201).json({ success: true });
});

app.post("/api/payment-requests/:id/action", authMiddleware, requireAdmin, async (req, res) => {
  const { action } = req.body ?? {};
  if (!["approve", "reject", "reverse"].includes(action)) {
    return res.status(400).json({ error: "Invalid action." });
  }

  try {
    await withTransaction(async (connection) => {
      const [requestRows] = await connection.execute(
        "SELECT * FROM payment_requests WHERE id = ? FOR UPDATE",
        [req.params.id],
      );
      const paymentRequest = requestRows[0];

      if (!paymentRequest) {
        throw new Error("Payment request not found.");
      }

      const [userRows] = await connection.execute(
        "SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE",
        [paymentRequest.user_id],
      );
      const account = userRows[0];

      if (!account) {
        throw new Error("User not found.");
      }

      if (action === "approve") {
        await connection.execute(
          "UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?",
          [paymentRequest.amount, paymentRequest.user_id],
        );
      }

      if (action === "reverse") {
        const nextBalance = Math.max(0, Number(account.wallet_balance) - Number(paymentRequest.amount));
        await connection.execute(
          "UPDATE users SET wallet_balance = ? WHERE id = ?",
          [nextBalance, paymentRequest.user_id],
        );
      }

      const status =
        action === "approve" ? "approved" : action === "reject" ? "rejected" : "reversed";
      await connection.execute(
        "UPDATE payment_requests SET status = ?, reviewed_at = NOW() WHERE id = ?",
        [status, req.params.id],
      );
    });

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/downloads/consume", authMiddleware, async (req, res) => {
  const { fileName } = req.body ?? {};
  if (!fileName) {
    return res.status(400).json({ error: "fileName is required." });
  }

  try {
    const result = await withTransaction(async (connection) => {
      const [userRows] = await connection.execute(
        "SELECT role, wallet_balance, total_downloads FROM users WHERE id = ? FOR UPDATE",
        [req.user.id],
      );
      const currentUser = userRows[0];

      if (!currentUser) {
        throw new Error("User not found.");
      }

      const isAdmin = currentUser.role === "admin";
      if (!isAdmin && Number(currentUser.wallet_balance) < 1) {
        const error = new Error("Insufficient credits. Please top up your wallet.");
        error.status = 400;
        throw error;
      }

      if (isAdmin) {
        await connection.execute(
          "UPDATE users SET total_downloads = total_downloads + 1 WHERE id = ?",
          [req.user.id],
        );
      } else {
        await connection.execute(
          `UPDATE users
           SET wallet_balance = wallet_balance - 1,
               total_downloads = total_downloads + 1
           WHERE id = ?`,
          [req.user.id],
        );
      }

      await connection.execute(
        "INSERT INTO downloads (id, user_id, file_name) VALUES (?, ?, ?)",
        [crypto.randomUUID(), req.user.id, fileName],
      );

      const [updatedRows] = await connection.execute(
        "SELECT wallet_balance, total_downloads, role FROM users WHERE id = ?",
        [req.user.id],
      );

      return updatedRows[0];
    });

    res.json({
      success: true,
      wallet_balance: Number(result.wallet_balance ?? 0),
      total_downloads: Number(result.total_downloads ?? 0),
      role: result.role,
    });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

app.get("/api/admin/users", authMiddleware, requireAdmin, async (_req, res) => {
  const rows = await query(
    `SELECT id, email, name, role, wallet_balance, total_downloads, created_at
     FROM users
     ORDER BY created_at DESC`,
  );
  res.json({ users: rows.map(sanitizeUser) });
});

app.post("/api/admin/users", authMiddleware, requireAdmin, async (req, res) => {
  const { name, email, password, role } = req.body ?? {};
  if (!name || !email || !password || !isValidRole(role)) {
    return res.status(400).json({ error: "Invalid payload." });
  }

  const existing = await query("SELECT id FROM users WHERE email = ?", [email]);
  if (existing.length > 0) {
    return res.status(409).json({ error: "A user with that email already exists." });
  }

  await query(
    `INSERT INTO users (
      id, email, password_hash, name, role, wallet_balance, total_downloads
    ) VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [
      crypto.randomUUID(),
      email,
      await hashPassword(password),
      name,
      role,
      role === "admin" ? 0 : config.walletStartingBalance,
    ],
  );

  res.status(201).json({ success: true });
});

app.patch("/api/admin/users/:id", authMiddleware, requireAdmin, async (req, res) => {
  const { name, email, wallet_balance, role } = req.body ?? {};
  const fields = [];
  const values = [];

  if (typeof name === "string") {
    fields.push("name = ?");
    values.push(name);
  }
  if (typeof email === "string") {
    fields.push("email = ?");
    values.push(email);
  }
  if (typeof wallet_balance === "number") {
    fields.push("wallet_balance = ?");
    values.push(wallet_balance);
  }
  if (role && isValidRole(role)) {
    fields.push("role = ?");
    values.push(role);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: "No updates provided." });
  }

  values.push(req.params.id);
  await query(
    `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
    values,
  );

  res.json({ success: true });
});

app.delete("/api/admin/users/:id", authMiddleware, requireAdmin, async (req, res) => {
  await query("DELETE FROM users WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(config.port, () => {
  console.log(`MySQL API listening on http://localhost:${config.port}`);
});
