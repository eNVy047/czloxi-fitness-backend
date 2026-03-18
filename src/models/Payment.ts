import { Schema, model, Document, Types } from 'mongoose';

export interface IPayment extends Document {
  userId: Types.ObjectId;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  receipt: string;
  amount: number;
  currency: string;
  status: 'pending' | 'success' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String },
    receipt: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: { 
      type: String, 
      enum: ['pending', 'success', 'failed'], 
      default: 'pending' 
    },
  },
  {
    timestamps: true,
  }
);

export const Payment = model<IPayment>('Payment', paymentSchema);
