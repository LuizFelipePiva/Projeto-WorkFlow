import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';

import auth from './features/Auth/routes/auth.js';
import jobs from './features/Jobs/routes/jobs.js';
import profile from './features/Profile/routes/profile.js';
import vagas from './features/AppliedJobs/routes/vagas.js';
import db from './shared/config/db.js';
import { createChatServer } from './features/Chat/socket/chatSocket.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Api rodando');
});

app.use("/auth", auth);
app.use("/jobs", jobs);
app.use("/profile", profile);
app.use("/vagas", vagas);
const server = createServer(app);
const allowedOrigins = (process.env.FRONTEND_URLS ||
  'http://localhost:3001,http://127.0.0.1:3001,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173')
  .split(',').map((origin) => origin.trim()).filter(Boolean);

createChatServer(server, { db, jwtSecret: process.env.JWT_SECRET, allowedOrigins });

server.listen(process.env.PORT || 3000, () => {
  console.log(`Servidor HTTP e WebSocket rodando na porta ${process.env.PORT || 3000}`);
});
