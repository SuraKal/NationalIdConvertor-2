import dotenv from "dotenv";

dotenv.config();

const required = [
  "MYSQL_HOST",
  "MYSQL_PORT",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "MYSQL_DATABASE",
  "JWT_SECRET",
];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`Missing environment variable: ${key}`);
  }
}

export const config = {
  port: Number(process.env.API_PORT || 3001),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:8080",
  jwtSecret: process.env.JWT_SECRET || "change-me",
  otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES || 10),
  walletStartingBalance: Number(process.env.DEFAULT_WALLET_BALANCE || 5),
  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "niddb_1",
  },
};
