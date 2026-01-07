Write-Host "🚀 Setting up Ecommerce Platform..." -ForegroundColor Cyan

# Frontend
Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Yellow
cd ../frontend
npm install

# Backend
Write-Host "📦 Installing backend dependencies..." -ForegroundColor Yellow
cd ../backend
npm install

Write-Host "🗄️ Running Prisma migrations..." -ForegroundColor Green
npx prisma migrate dev

# Run both apps
Write-Host "🔥 Starting backend..." -ForegroundColor Magenta
Start-Process powershell "npm run start:dev"

Write-Host "🔥 Starting frontend..." -ForegroundColor Magenta
cd ../frontend
npm run dev
