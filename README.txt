# ⚡ TaskFlow — Team Task Manager

## ⚙️ Local Setup

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)

### 1. Clone & Install

```bash
git clone <your-repo>
cd team-task-manager

# Install all dependencies (root + client)
npm run install-all
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/team-task-manager
JWT_SECRET=your_very_long_random_secret_here
NODE_ENV=development
```

### 3. Run Development

```bash
npm run dev
```

- Backend: http://localhost:5000
- Frontend: http://localhost:3000

## 🚂 Deploy to Railway

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add a **MongoDB** plugin (or use MongoDB Atlas and add `MONGO_URI`)
4. Set environment variables:
   - `MONGO_URI` — your MongoDB connection string
   - `JWT_SECRET` — a long random string
   - `NODE_ENV` — `production`
5. Railway auto-detects `railway.toml` and runs `npm run build` then `npm start`
6. Your app is live! 🎉