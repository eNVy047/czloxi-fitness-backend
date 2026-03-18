import { FastifyReply, FastifyRequest } from 'fastify';
import { User } from '../../models/User';

export const subscriptionGuard = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id: userId } = request.user as { id: string };
  
  const user = await User.findById(userId).select('subscriptionStatus trialEndsAt subscriptionEndDate');
  
  if (!user) {
    return reply.status(403).send({ 
      error: 'Forbidden', 
      message: 'User not found', 
      code: 'USER_NOT_FOUND' 
    });
  }

  const now = new Date();
  const isTrialActive = user.subscriptionStatus === 'trial' && user.trialEndsAt && user.trialEndsAt > now;
  const isSubscribed = user.subscriptionStatus === 'active' && user.subscriptionEndDate && user.subscriptionEndDate > now;

  if (!isTrialActive && !isSubscribed) {
    return reply.status(403).send({ 
      error: 'Forbidden', 
      message: 'Subscription required', 
      code: 'SUBSCRIPTION_EXPIRED' 
    });
  }
};
