import * as jwt from 'jsonwebtoken';
import { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env';

const ADMIN_PHONE = "9818462200";
const ADMIN_JWT_SECRET = env.ADMIN_JWT_SECRET || "admin_secret_key";

export const adminLogin = async (req: FastifyRequest<{ Body: { phone: string } }>, res: FastifyReply) => {
  const { phone } = req.body;
  if (phone !== ADMIN_PHONE) {
    return res.status(403).send({ message: "Access denied" });
  }
  
  const token = jwt.sign(
    { phone, role: "admin" },
    ADMIN_JWT_SECRET,
    { expiresIn: "7d" }
  );
  
  return res.status(200).send({ token, role: "admin" });
};
