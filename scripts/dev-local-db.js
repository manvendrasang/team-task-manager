/**
 * Boots an ephemeral local MongoDB (via mongodb-memory-server), then starts the
 * real Express server against it. Nothing is written to .env and no MongoDB
 * install is required — data lives in a temp directory and is discarded when
 * you stop the process.
 *
 *   npm run dev:local
 *
 * Use this while you don't have a real MONGO_URI yet. Once you do, drop it in
 * .env and use `npm run dev` instead.
 */
require('dotenv').config();

const path = require('path');
const { spawn } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 5000;

const startServer = (uri) => {
  const child = spawn(process.execPath, [path.join(REPO, 'server/index.js')], {
    cwd: REPO,
    stdio: 'inherit',
    env: {
      ...process.env,
      MONGO_URI: uri,
      // Ephemeral database: a throwaway secret is fine and keeps .env untouched.
      JWT_SECRET: process.env.JWT_SECRET || require('crypto').randomBytes(48).toString('base64'),
    },
  });

  child.on('exit', (code) => process.exit(code ?? 0));
  return child;
};

(async () => {
  let MongoMemoryServer;
  try {
    ({ MongoMemoryServer } = require('mongodb-memory-server'));
  } catch {
    console.error('\n❌ mongodb-memory-server is not installed.\n');
    console.error('   It is a devDependency, so run:  npm install\n');
    process.exit(1);
  }

  console.log('⏳ Starting a temporary local MongoDB (first run downloads it)...\n');

  let mongo;
  try {
    mongo = await MongoMemoryServer.create({ instance: { port: 27017, dbName: 'taskflow' } });
  } catch (err) {
    console.error('❌ Could not start the temporary MongoDB:', err.message);
    console.error('\n   If port 27017 is taken by another MongoDB, stop it and retry.');
    console.error('   Otherwise install MongoDB locally and use .env instead —\n');
    console.error('   pacman -S mongodb   # Arch Linux\n');
    process.exit(1);
  }

  console.log(`✅ Temporary MongoDB up at ${mongo.getUri()}`);
  console.log('   (in-memory — everything is discarded when you stop)\n');

  const child = startServer(mongo.getUri());

  const shutdown = async () => {
    child.kill('SIGINT');
    await mongo.stop().catch(() => {});
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();