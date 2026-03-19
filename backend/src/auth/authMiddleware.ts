import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AuthTokenPayload } from "./AuthService";
import { getDbPool } from "../storage/PostgresClient";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

export type AuthenticatedRequest = Request & {
  user?: AuthTokenPayload;
};

export async function userHasAction(userId: number, action: string): Promise<boolean> {
  const pool = getDbPool();
  const result = await pool.query(
    `SELECT 1
     FROM user_roles ur
     JOIN role_actions ra ON ra.role_id = ur.role_id
     JOIN actions a ON a.id = ra.action_id
     WHERE ur.user_id = $1 AND a.name = $2
     LIMIT 1`,
    [userId, action]
  );

  return (result.rowCount ?? 0) > 0;
}

export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers["authorization"];
  const token =
    authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Unauthorized", message: "No token provided." });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token." });
  }
}

export function requireAction(action: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", message: "No user in token payload." });
      return;
    }

    try {
      const allowed = await userHasAction(userId, action);
      if (!allowed) {
        res.status(403).json({ error: "Forbidden", message: "unauthorized action" });
        return;
      }

      next();
    } catch (err) {
      console.error("Unexpected error in permission middleware:", err);
      res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
    }
  };
}
