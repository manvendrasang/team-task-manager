const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Public healthcheck for Railway
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks',    require('./routes/tasks'));
app.use('/api/users',    require('./routes/users'));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) =>
    res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'))
  );
}

const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');

    // Drop ALL stale indexes from old schemas, keep only _id and email
    try {
      const userCol = mongoose.connection.collection('users');
      const indexes = await userCol.indexes();
      const staleNames = indexes
        .map(i => i.name)
        .filter(name => name !== '_id_' && name !== 'email_1');

      for (const name of staleNames) {
        await userCol.dropIndex(name);
        console.log(`🧹 Dropped stale index: ${name}`);
      }
    } catch (e) {
      console.log('Index cleanup note:', e.message);
    }

    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });