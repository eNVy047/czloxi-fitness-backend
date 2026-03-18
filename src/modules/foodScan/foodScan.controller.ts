import { FastifyReply, FastifyRequest } from 'fastify';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FoodScan } from '../../models/FoodScan';
import { DashboardService } from '../dashboard/dashboard.service';
import { sendSuccess } from '../../utils/response';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY!);

export class FoodScanController {

  static async analyzeFood(request: FastifyRequest<{ Body: { imageBase64: string } }>, reply: FastifyReply) {
    try {
      const { imageBase64 } = request.body;
      if (!imageBase64) {
        return reply.status(400).send({ success: false, message: 'No image provided' });
      }

      // Initialize the Gemini model for vision
      const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

      // Clean the base64 string if it has a data URI prefix
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

      const prompt = `Analyze this food image and return a strict JSON object with the following structure:
      {
        "foodName": "Name of the food",
        "calories": number,
        "fat": number,
        "protein": number,
        "carbs": number,
        "description": "Short 2-line description of the food",
        "ingredients": ["ingredient1", "ingredient2", ...]
      }
      Do not wrap the JSON in markdown code blocks or any other characters. Just return the raw JSON string.`;

      const imageParts = [
        {
          inlineData: {
            data: base64Data,
            mimeType: 'image/jpeg', // Defaulting to jpeg, frontend should send correctly formatted base64
          },
        },
      ];

      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      let text = response.text().trim();

      // Attempt to clean text if Gemini returned markdown formatting anyway
      if (text.startsWith('```json')) {
        text = text.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (text.startsWith('```')) {
        text = text.replace(/^```/, '').replace(/```$/, '').trim();
      }

      const nutritionalData = JSON.parse(text);

      return sendSuccess(reply, { data: nutritionalData }, 'Food analyzed successfully');
    } catch (error) {
      logger.error({ err: error, user: request.user }, 'Error POST food/analyze');
      throw error;
    }
  }

  static async saveFood(
    request: FastifyRequest<{
      Body: {
        imageBase64?: string;
        foodName: string;
        calories: number;
        fat: number;
        protein: number;
        carbs: number;
        description: string;
        ingredients: string[];
        type: 'eat' | 'test';
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const userId = (request.user as any).id;
      const { imageBase64, foodName, calories, fat, protein, carbs, description, ingredients, type } = request.body;

      // 1. Calculate expiration if type is 'test'
      const expiresAt = type === 'test' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null;

      // 2. Save scan record
      const scan = new FoodScan({
        userId,
        image: imageBase64, // could be very large depending on how base64 is handled, but assuming acceptable for now
        foodName,
        calories,
        fat,
        protein,
        carbs,
        description,
        ingredients,
        type,
        expiresAt,
      });
      await scan.save();

      // 3. If 'eat', update the Dashboard DailyLog
      if (type === 'eat') {
        const todayLog = await DashboardService.getOrCreateTodayLog(userId);
        todayLog.caloriesConsumed += calories;
        todayLog.fatConsumed += fat;
        todayLog.proteinConsumed += protein;
        todayLog.carbsConsumed += carbs;
        await todayLog.save();
      }

      return sendSuccess(reply, { scan }, 'Food saved successfully');
    } catch (error) {
      logger.error({ err: error, user: request.user }, 'Error POST food/save');
      throw error;
    }
  }
}
