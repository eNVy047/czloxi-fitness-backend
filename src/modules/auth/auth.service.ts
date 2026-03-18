import bcrypt from 'bcryptjs';
import { User, IUser } from '../../models/User';
import { RegisterInput, LoginInput } from './auth.schema';
import { ConflictError, UnauthorizedError } from '../../utils/errors';

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
}
