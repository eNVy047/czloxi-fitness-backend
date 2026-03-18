import { JWT } from '@fastify/jwt';

declare module 'fastify' {
  interface FastifyRequest {
    jwt: JWT;
  }
  export interface FastifyInstance {
    authenticate: any;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; email: string; subscriptionTier: string; subscriptionStatus: string };
    user: {
      id: string;
      email: string;
      subscriptionTier: string;
      subscriptionStatus: string;
    };
  }
}
