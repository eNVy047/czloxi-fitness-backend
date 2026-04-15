import { FastifyReply, FastifyRequest } from 'fastify';
import { User } from '../../models/User';

export const subscriptionGuard = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id: userId } = request.user as { id: string };
  
  const user = await User.findById(userId);
  
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'User not found' });
  }

  const now = new Date();
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

  // 1. Reset daily scans if date changed
  if (user.lastScanDate !== today) {
    user.scansToday = 0;
    user.lastScanDate = today;
    await user.save();
  }

  const isTrialActive = user.subscriptionStatus === 'trial' && user.trialEndsAt && user.trialEndsAt > now;
  const isSubscribed = user.subscriptionStatus === 'active' && user.subscriptionEndDate && user.subscriptionEndDate > now;
  const hasProAccess = isTrialActive || isSubscribed;

  const url = request.url;

  // 2. Chat Access Control
  if (url.includes('/api/v1/chat')) {
    if (!hasProAccess) {
      return reply.status(403).send({ 
        error: 'Forbidden', 
        message: 'Upgrade to PRO or start a free trial to use Caloxi AI Chat.', 
        code: 'CHAT_RESTRICTED' 
      });
    }
  }

  // 3. Scan Limit Protection
  if (url.includes('/api/v1/food/analyze')) {
    const limit = hasProAccess ? 15 : 1;

    if (user.scansToday >= limit) {
      return reply.status(429).send({ 
        error: 'Too Many Requests', 
        message: hasProAccess 
          ? 'Daily Pro limit (15 scans) reached. Come back tomorrow!' 
          : 'Daily Free limit (1 scan) reached. Upgrade to PRO for 15 scans/day!', 
        code: 'SCAN_LIMIT_REACHED'
      });
    }
  }
};
