import express from 'express';
import UserService from '../services/UserService';
import authMiddleware from '../middleware/authMiddleware';

const router = express.Router();

// 注册用户
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const token = await UserService.register(username, password);
    res.status(201).json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 登录用户
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const token = await UserService.login(username, password);
    res.json({ token });
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
});

// 获取所有用户（需要管理员权限）
router.get('/users', authMiddleware, async (req, res) => {
  try {
    const users = await UserService.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;