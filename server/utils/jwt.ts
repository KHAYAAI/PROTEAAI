import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error(
    "JWT_SECRET environment variable is required. " +
    "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" " +
    "then set it in your .env file or docker-compose.yml.",
  );
}

export const jwtSecret: string = secret;

export interface TokenPayload {
  userId: string;
  jti: string;
}

/** Create a JWT token with userId and unique JTI (JWT ID) claim. */
export function createToken(userId: string, expiresIn: string = "7d"): string {
  const jti = randomBytes(16).toString("hex");
  return jwt.sign({ sub: userId, jti }, jwtSecret, { expiresIn });
}

/** Verify a JWT and return the userId and JTI, or null if invalid/expired. */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, jwtSecret) as { sub: string; jti: string };
    return { userId: payload.sub, jti: payload.jti };
  } catch {
    return null;
  }
}
