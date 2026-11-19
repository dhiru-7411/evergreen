// Promotes (or demotes) a user so they can manage topics.
//
//   npm run make-admin -- <username>
//   npm run make-admin -- <username> --revoke
require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const [username, flag] = process.argv.slice(2);
  if (!username) {
    console.error('Usage: npm run make-admin -- <username> [--revoke]');
    process.exit(1);
  }
  const role = flag === '--revoke' ? 'user' : 'admin';

  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOneAndUpdate({ username }, { role }, { new: true });
  if (!user) {
    console.error(`No user named "${username}".`);
    process.exitCode = 1;
  } else {
    console.log(`@${user.username} is now ${role === 'admin' ? 'an admin' : 'a regular user'}.`);
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
