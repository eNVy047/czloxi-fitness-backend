import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  userId?: mongoose.Types.ObjectId; // Optional for bulk notifications
  type: 'meal' | 'water' | 'activity' | 'sleep' | 'streak' | 'subscription' | 'admin' | 'achievement' | 'report' | 'reminder' | 'promo' | 'general';
  title: string;
  message: string;
  isRead: boolean;
  
  // Admin Notification Fields
  targetType?: 'all' | 'selected' | 'filter';
  targetFilter?: {
    subscriptionStatus?: string[];
    fitnessGoal?: string[];
    inactiveDays?: number;
  };
  targetUserIds?: mongoose.Types.ObjectId[];
  
  status?: 'pending' | 'sent' | 'failed' | 'scheduled';
  totalSent?: number;
  delivered?: number;
  failed?: number;
  
  scheduledAt?: Date;
  sentAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    type: { 
      type: String, 
      enum: ['meal', 'water', 'activity', 'sleep', 'streak', 'subscription', 'admin', 'achievement', 'report', 'reminder', 'promo', 'general'], 
      required: true 
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    
    // Admin Fields
    targetType: { type: String, enum: ['all', 'selected', 'filter'] },
    targetFilter: {
      subscriptionStatus: [{ type: String }],
      fitnessGoal: [{ type: String }],
      inactiveDays: { type: Number }
    },
    targetUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    
    status: { 
      type: String, 
      enum: ['pending', 'sent', 'failed', 'scheduled'],
      default: 'sent' 
    },
    totalSent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    
    scheduledAt: { type: Date },
    sentAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  }
);

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
