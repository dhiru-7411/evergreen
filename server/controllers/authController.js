const jwt = require('jsonwebtoken');
const User = require('../models/User');
const HttpError = require('../utils/httpError');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const publicUser = (user) => ({ id: user._id, username: user.username, email: user.email });

const register = async (req, res) => {
  const { username, email, password } = req.body;

  const existingUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existingUser) throw new HttpError(409, 'Username or email already in use');

  const user = await User.create({ username, email, password });
  res.status(201).json({ token: generateToken(user._id), user: publicUser(user) });
};

const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  // Same message for both cases so the endpoint can't be used to probe for accounts.
  if (!user || !(await user.comparePassword(password))) {
    throw new HttpError(401, 'Invalid email or password');
  }

  res.status(200).json({ token: generateToken(user._id), user: publicUser(user) });
};

const me = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(401, 'Account no longer exists');
  res.json({ user: publicUser(user) });
};

module.exports = { register, login, me };
