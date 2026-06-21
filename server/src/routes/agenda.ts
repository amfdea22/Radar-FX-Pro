import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const { status, category } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;
    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const { title, description, priority, category, dueDate } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        priority: priority || 'medium',
        category: category || 'trading',
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { title, description, status, priority, category, dueDate } = req.body;
    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(priority && { priority }),
        ...(category && { category }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      },
    });
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await prisma.task.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/tasks/:id/toggle', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const updated = await prisma.task.update({
      where: { id },
      data: { status: newStatus },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
