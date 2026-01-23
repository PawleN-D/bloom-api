// prisma/seed.ts
import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create worker user
  const workerPassword = await bcrypt.hash('SecurePass123', 10)
  const worker = await prisma.user.upsert({
    where: { email: 'worker@bloom.com' },
    update: {},
    create: {
      email: 'worker@bloom.com',
      password: workerPassword,
      firstName: 'John',
      lastName: 'Worker',
      role: UserRole.WORKER
    }
  })
  console.log('✅ Created worker:', worker.email)

  // Create admin user
  const adminPassword = await bcrypt.hash('AdminPass123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@bloom.com' },
    update: {},
    create: {
      email: 'admin@bloom.com',
      password: adminPassword,
      firstName: 'Jane',
      lastName: 'Admin',
      role: UserRole.ADMIN
    }
  })
  console.log('✅ Created admin:', admin.email)

  // Create test clients
  const client1 = await prisma.client.upsert({
    where: { id: 'seed-client-1' },
    update: {},
    create: {
      id: 'seed-client-1',
      firstName: 'Mary',
      lastName: 'Johnson',
      dateOfBirth: new Date('1945-03-15'),
      phone: '+27123456789',
      email: 'mary@example.com',
      address: '123 Main Street, Cape Town',
      conditions: JSON.stringify(['Diabetes', 'Arthritis']),
      allergies: JSON.stringify(['Penicillin']),
      emergencyContactName: 'John Johnson',
      emergencyContactPhone: '+27987654321',
      emergencyContactRelation: 'Son'
    }
  })
  console.log('✅ Created client:', client1.firstName, client1.lastName)

  const client2 = await prisma.client.upsert({
    where: { id: 'seed-client-2' },
    update: {},
    create: {
      id: 'seed-client-2',
      firstName: 'Robert',
      lastName: 'Smith',
      dateOfBirth: new Date('1938-07-22'),
      phone: '+27111222333',
      address: '456 Oak Avenue, Cape Town',
      conditions: JSON.stringify(['Hypertension']),
      carePlan: 'Regular blood pressure monitoring'
    }
  })
  console.log('✅ Created client:', client2.firstName, client2.lastName)

  // Assign clients to worker
  await prisma.assignment.upsert({
    where: { 
      userId_clientId: {
        userId: worker.id,
        clientId: client1.id
      }
    },
    update: {},
    create: {
      userId: worker.id,
      clientId: client1.id
    }
  })
  console.log('✅ Assigned', client1.lastName, 'to', worker.firstName)

  await prisma.assignment.upsert({
    where: { 
      userId_clientId: {
        userId: worker.id,
        clientId: client2.id
      }
    },
    update: {},
    create: {
      userId: worker.id,
      clientId: client2.id
    }
  })
  console.log('✅ Assigned', client2.lastName, 'to', worker.firstName)

  console.log('🎉 Seeding complete!')
  console.log('\n📝 Test credentials:')
  console.log('Worker: worker@bloom.com / SecurePass123')
  console.log('Admin:  admin@bloom.com / AdminPass123')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })