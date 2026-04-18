import { FastifyReply, FastifyRequest } from 'fastify';
import { geminiFlash } from '../../config/gemini';
import { User } from '../../models/User';
import { sendSuccess } from '../../utils/response';
import { logger } from '../../utils/logger';

export class ChatController {
  static async message(
    request: FastifyRequest<{ Body: { message: string, history?: any[] } }>,
    reply: FastifyReply
  ) {
    try {
      const { message, history = [] } = request.body;
      logger.info({ message }, '📥 Chat request received');

      const userId = (request.user as any).id;
      const user = await User.findById(userId);

      if (!user) {
        return reply.status(401).send({ success: false, message: 'User not found' });
      }

      const isTrialActive = user.subscriptionStatus === 'trial' && user.trialEndsAt && new Date(user.trialEndsAt) > new Date();
      const hasProAccess = user.subscriptionTier === 'pro' || isTrialActive;

      if (!hasProAccess) {
        return reply.status(403).send({ 
          success: false, 
          message: 'Chat feature requires a Pro subscription or active trial.',
          isPro: false
        });
      }

      if (!message) {
        return reply.status(400).send({ success: false, message: 'Message is required' });
      }

      const systemInstruction = `You are Caloxi, a premium AI fitness and diet coach. 
      Your goal is to provide highly personalized, motivating, and science-backed advice.
      
      Structure your response as a JSON object:
      {
        "text": "Your message here",
        "list": ["item 1", "item 2"],
        "suggestions": ["suggestion 1", "suggestion 2"]
      }`;

      // Clean history for Gemini validation
      let formattedHistory = (history || []).map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text || '' }]
      }));

      // Find first user message
      const firstUserIndex = formattedHistory.findIndex(h => h.role === 'user');
      formattedHistory = firstUserIndex !== -1 ? formattedHistory.slice(firstUserIndex) : [];

      logger.info({ historyLength: formattedHistory.length }, '🕒 History formatted');

      const chat = geminiFlash.startChat({
        history: formattedHistory,
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      logger.info('🛰️ Calling Gemini API...');
      const result = await chat.sendMessage([
        { text: systemInstruction },
        { text: message }
      ]);
      
      const response = await result.response;
      let responseText = response.text().trim();
      logger.info({ responseText }, '📡 Gemini response received');

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        logger.error({ responseText }, '❌ Failed to parse JSON, returning as text');
        data = { text: responseText, list: [], suggestions: [] };
      }

      return sendSuccess(reply, data, 'Success');
    } catch (error: any) {
      logger.error({ 
        msg: error.message, 
        stack: error.stack,
        status: error.status 
      }, '💥 ERROR in ChatController.message');
      
      return reply.status(500).send({ 
        success: false, 
        message: 'AI Service Error', 
        details: error.message 
      });
    }
  }
}
