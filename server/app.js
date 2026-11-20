// The Express app with no side effects (no DB connection, no listen), so
// tests can import it and drive it with supertest.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const originCheck = require('./middleware/originCheck');

const postRoutes = require('./routes/postRoutes');
const authRoutes = require('./routes/authRoutes');
const fixRoutes = require('./routes/fixRoutes');
const userRoutes = require('./routes/userRoutes');
const topicRoutes = require('./routes/topicRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const pathRoutes = require('./routes/pathRoutes');
const topicRequestRoutes = require('./routes/topicRequestRoutes');
const seoRoutes = require('./routes/seoRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

const app = express();

// Number of proxies in front of the app, so req.ip (used for rate limits) is
// the real client. Render alone = 1; Vercel rewrite -> Render = 2.
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(cookieParser());
app.use(originCheck(allowedOrigins));
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
app.use('/api/topic-requests', topicRequestRoutes);
app.use('/api', seoRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
