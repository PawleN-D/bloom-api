import dotenv from 'dotenv'


dotenv.config()

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  
  databaseUrl: process.env.DATABASEPUBLIC_URL!,
  
  jwtSecret: process.env.JWT_SECRET!,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  sessionUnlockExpiresIn: process.env.SESSION_UNLOCK_EXPIRES_IN || '5m',

  baseDomain: process.env.BASE_DOMAIN || 'bloom.com',
  
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  frontendUrls: (() => {
    const list = process.env.FRONTEND_URLS
      ? process.env.FRONTEND_URLS.split(',')
      : [];

    const defaults = [
      process.env.CARE_APP_URL,
      process.env.FRONTEND_URL,
      process.env.HQ_APP_URL,
      'http://localhost:3000',
      'http://localhost:3001',
    ];

    const combined = [...list, ...defaults]
      .map((item) => (item || '').trim())
      .filter(Boolean);

    return Array.from(new Set(combined));
  })(),
  
  logLevel: process.env.LOG_LEVEL || 'info',
  
  r2AccountId: process.env.R2_ACCOUNT_ID,
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  r2BucketName: process.env.R2_BUCKET_NAME,
  r2PublicUrl: process.env.R2_PUBLIC_URL,
} as const

function validateEnv() {
  const required = ['DATABASE_URL', 'JWT_SECRET']
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

if (process.env.NODE_ENV !== 'test') {
  validateEnv()
}
