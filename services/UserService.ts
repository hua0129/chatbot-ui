import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';

class UserService {
  // 注册用户
  static async register(username: string, password: string): Promise<string> {
    const user = new User({ username, password });
    await user.save();
    return this.generateToken(user);
  }

  // 登录用户
  static async login(username: string, password: string): Promise<string> {
    const user = await User.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
      throw new Error('Invalid credentials');
    }
    return this.generateToken(user);
  }

  // 生成 JWT Token
  private static generateToken(user: IUser): string {
    return jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: '1h',
    });
  }

  // 获取所有用户（管理员权限）
  static async getAllUsers(): Promise<IUser[]> {
    return User.find().select('-password'); // 不返回密码字段
  }
}

export default UserService;