// The Express app with no side effects (no DB connection, no listen), so
// tests can import it and drive it with supertest.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const postRoutes = require('./routes/postRoutes');
const authRoutes = require('./routes/authRoutes');
const fixRoutes = require('./routes/fixRoutes');
const userRoutes = require('./routes/userRoutes');
const topicRoutes = require('./routes/topicRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const pathRoutes = require('./routes/pathRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

const app = express();

app.set('trust proxy', 1); // correct client IPs for rate limiting behind Render/Fly/etc.
app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '200kb' }));

app.get('/', (req, res) => {
  res.send('Evergreen API is running');
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/posts', postRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/fixes', fixRoutes);
app.use('/api/users', userRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/paths', pathRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
