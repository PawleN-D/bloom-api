# Bloom API

Backend API for Bloom care management platform.

## Tech Stack

- **Framework:** Fastify
- **Database:** PostgreSQL + Prisma
- **Auth:** JWT
- **Storage:** Cloudflare R2
- **Testing:** Jest + Supertest
- **Language:** TypeScript

## Getting Started
```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your values

# Set up database
npm run prisma:generate
npm run prisma:migrate

# Run tests
npm test

# Start development server
npm run dev
```

## API Documentation

Once running, visit: http://localhost:3001/docs

## Deployment

Deployed on Railway: https://bloom-api-production.up.railway.app