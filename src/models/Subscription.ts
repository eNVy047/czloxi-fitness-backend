import { Schema, model, Document, Types } from 'mongoose';

export interface ISubscription extends Document {
  userId: Types.ObjectId;
  razorpaySubscriptionId: string;
  razorpayPlanId: string;
  status: 'active' | 'past_due' | 'canceled' | 'completed';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    razorpaySubscriptionId: { type: String, required: true, unique: true },
    razorpayPlanId: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['active', 'past_due', 'canceled', 'completed'],
      required: true 
    },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
  },
  {
    timestamps: true,
  }
);

export const Subscription = model<ISubscription>('Subscription', subscriptionSchema);
