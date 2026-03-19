import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDbPool } from "../storage/PostgresClient";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

if (!process.env.JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET env var not set. Using default dev secret.");
}

export interface RegisterInput {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthResult {
  token: string;
  username: string;
  firstName: string;
  lastName: string;
}

export interface AuthTokenPayload {
  userId: number;
  username: string;
}

export interface CreatedUser {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
}

export async function createUserAccount(input: RegisterInput): Promise<CreatedUser> {
  const pool = getDbPool();

  const existing = await pool.query("SELECT id FROM users WHERE username = $1", [input.username]);
  if (existing.rowCount && existing.rowCount > 0) {
    throw new Error("USERNAME_TAKEN");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const result = await pool.query(
    `INSERT INTO users (username, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, first_name, last_name`,
    [input.username, passwordHash, input.firstName, input.lastName]
  );

  const user = result.rows[0];
  return {
    id: user.id,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
  };
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const user = await createUserAccount(input);
  const token = jwt.sign(
    { userId: user.id, username: user.username } satisfies AuthTokenPayload,
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  return { token, username: user.username, firstName: user.firstName, lastName: user.lastName };
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const pool = getDbPool();

  const result = await pool.query(
    "SELECT id, username, password_hash, first_name, last_name FROM users WHERE username = $1",
    [input.username]
  );

  if (!result.rowCount || result.rowCount === 0) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const user = result.rows[0];
  const valid = await bcrypt.compare(input.password, user.password_hash);
  if (!valid) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username } satisfies AuthTokenPayload,
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  return { token, username: user.username, firstName: user.first_name, lastName: user.last_name };
}
