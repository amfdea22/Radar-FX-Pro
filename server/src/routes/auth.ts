import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'radar-fx-secret-key-change-in-production';

const users = new Map<string, { username: string; password: string }>();
users.set('admin', {
  username: 'admin',
  password: bcrypt.hashSync('radar2024', 10),
});

router.post('/register', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha obrigatórios' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Usuário deve ter pelo menos 3 caracteres' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
  }
  if (users.has(username)) {
    return res.status(409).json({ error: 'Usuário já existe' });
  }
  users.set(username, {
    username,
    password: bcrypt.hashSync(password, 10),
  });
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, username, message: 'Conta criada com sucesso' });
});

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha obrigatórios' });
  }
  const user = users.get(username);
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }
  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, username });
});

router.post('/recover', (req: Request, res: Response) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Informe o nome de usuário' });
  }
  if (!users.has(username)) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }
  res.json({ message: 'Instruções de recuperação enviadas. Entre em contato com o suporte para redefinir sua senha.' });
});

export default router;
