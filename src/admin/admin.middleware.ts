import * as jwt from 'jsonwebtoken';
import { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env';

export const adminAuth = async (req: FastifyRequest, res: FastifyReply) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];
  
  if (!token) {
    return res.status(401).send({ message: "No token" });
  }
  
  try {
    const decoded = jwt.verify(token, env.ADMIN_JWT_SECRET) as any;
    if (decoded.role !== "admin") {
      return res.status(403).send({ message: "Not admin" });
    }
    // Fastify-style request decoration
    (req as any).admin = decoded;
  } catch (err) {
    return res.status(401).send({ message: "Invalid or expired token" });
  }
};
