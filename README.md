# Personal Assistant Backend

Node.js Express API with PostgreSQL (Supabase)

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Supabase Database

#### Get Your Supabase Connection String:
1. Go to your Supabase project dashboard
2. Click on **Settings** (gear icon) → **Database**
3. Scroll down to **Connection string** section
4. Copy the **Connection string** (URI format)
5. Replace `[YOUR-PASSWORD]` with your database password

The format will be:
```
postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

#### Alternative: Connection Pooling (Recommended for Production)
For better performance, use the **Connection Pooling** string:
1. In Supabase Dashboard → Settings → Database
2. Find **Connection Pooling** section
3. Copy the **Connection string** (make sure "Transaction" mode is selected)
4. It will look like:
```
postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

### 3. Create .env File
Copy `.env.example` to `.env` and add your credentials:
```bash
cp .env.example .env
```

Edit `.env` and replace with your actual Supabase connection string:
```env
PORT=3000
DATABASE_URL=postgresql://postgres:YOUR_ACTUAL_PASSWORD@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
```

### 4. Run the Server

**Development mode** (with auto-reload):
```bash
npm run dev
```

**Production mode**:
```bash
npm start
```

### 5. Test the Connection

Open your browser or use curl:
```bash
# Health check
curl http://localhost:3000

# Database connection test
curl http://localhost:3000/api/db-test
```

If successful, you'll see:
```json
{
  "success": true,
  "message": "Database connection successful",
  "timestamp": "2026-02-06T15:48:35.123Z"
}
```

## Project Structure

```
my_personal_assistant_backend/
├── config/
│   └── database.js       # PostgreSQL connection pool
├── routes/               # API routes (add your routes here)
├── .env                  # Environment variables (create this)
├── .env.example          # Template for environment variables
├── .gitignore
├── package.json
├── server.js             # Main Express application
└── README.md
```

## Next Steps

1. Create routes in `routes/` folder
2. Add controllers for business logic
3. Create models for database queries
4. Add authentication middleware
5. Implement your API endpoints

## Troubleshooting

**Connection fails?**
- Ensure your Supabase database password is correct
- Check if your IP is allowed (Supabase → Settings → Database → Connection pooling → Add your IP)
- Verify the connection string format
- Test connection directly in Supabase SQL Editor first

**SSL Error?**
The `ssl: { rejectUnauthorized: false }` is already configured for Supabase.
