import bcrypt from 'bcryptjs';
import { User, IUser } from '../../models/User';
import { RegisterInput, LoginInput } from './auth.schema';
import { ConflictError, UnauthorizedError, NotFoundError } from '../../utils/errors';
import { resend, emailDefaults } from '../../config/resend';
import crypto from 'crypto';

export class AuthService {
  static async registerUser(data: RegisterInput): Promise<IUser> {
    const existingUser = await User.findOne({ email: data.email });

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const newUser = new User({
      fullName: data.fullName,
      email: data.email,
      passwordHash,
    });

    await newUser.save();
    return newUser;
  }

  static async loginUser(data: LoginInput): Promise<IUser> {
    const user = await User.findOne({ email: data.email });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isMatch = await user.comparePassword(data.password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    return user;
  }

  static async forgotPassword(email: string): Promise<void> {
    const user = await User.findOne({ email });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Generate a temporary 8-character password
    const tempPassword = crypto.randomBytes(4).toString('hex');

    // Hash it
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(tempPassword, salt);

    await user.save();

    // Console log in backend only as requested
    console.log(`\n--- PASSWORD RESET ---\nEmail: ${email}\nNew Password: ${tempPassword}\n----------------------\n`);

    // Send email via Resend
    await resend.emails.send({
      ...emailDefaults,
      to: email,
      subject: 'Your New Password - Caloxi',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #FF8C00;">Reset Your Password</h2>
          <p>Hello ${user.fullName || 'User'},</p>
          <p>We received a request to reset your Caloxi password. Your new temporary password is:</p>
          <div style="background: #f4f4f4; padding: 15px; font-size: 24px; font-family: monospace; font-weight: bold; text-align: center; border-radius: 8px; margin: 20px 0;">
            ${tempPassword}
          </div>
          <p>Please log in using this password and update it in your profile settings as soon as possible.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <br/>
          <p>Best regards,<br/>The Caloxi Team</p>
        </div>
      `
    });
  }
}
