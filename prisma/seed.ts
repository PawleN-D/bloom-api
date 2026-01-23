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

  // Create tasks for client1 (Mary Johnson)
  const task1 = await prisma.task.upsert({
    where: { id: 'seed-task-1' },
    update: {},
    create: {
      id: 'seed-task-1',
      title: 'Morning medication',
      description: 'Administer blood pressure medication with breakfast',
      category: 'MEDICATION',
      priority: 'HIGH',
      clientId: client1.id,
      isRecurring: true
    }
  })
  console.log('✅ Created task:', task1.title)

  const task2 = await prisma.task.upsert({
    where: { id: 'seed-task-2' },
    update: {},
    create: {
      id: 'seed-task-2',
      title: 'Assist with bathing',
      description: 'Help with morning shower and personal care',
      category: 'PERSONAL_CARE',
      priority: 'NORMAL',
      clientId: client1.id,
      isRecurring: true
    }
  })
  console.log('✅ Created task:', task2.title)

  const task3 = await prisma.task.upsert({
    where: { id: 'seed-task-3' },
    update: {},
    create: {
      id: 'seed-task-3',
      title: 'Prepare diabetic-friendly lunch',
      description: 'Low sugar, balanced meal',
      category: 'MEAL_PREP',
      priority: 'NORMAL',
      clientId: client1.id,
      isRecurring: true
    }
  })
  console.log('✅ Created task:', task3.title)

  // Create tasks for client2 (Robert Smith)
  const task4 = await prisma.task.upsert({
    where: { id: 'seed-task-4' },
    update: {},
    create: {
      id: 'seed-task-4',
      title: 'Check blood pressure',
      description: 'Monitor and record vital signs',
      category: 'HEALTH_MONITORING',
      priority: 'HIGH',
      clientId: client2.id,
      isRecurring: true
    }
  })
  console.log('✅ Created task:', task4.title)

  // Complete one task to show history
  await prisma.taskCompletion.create({
    data: {
      taskId: task1.id,
      completedBy: worker.id,
      notes: 'Medication administered at 9:00 AM. Patient took pills with breakfast. No adverse reactions observed.'
    }
  })
  console.log('✅ Created task completion for:', task1.title)

  // Create notes for client1 (Mary Johnson)
  await prisma.note.create({
    data: {
      content: 'Patient completed all morning tasks successfully. Blood pressure was 120/80, within normal range. Took medication without any issues. Patient was in good spirits and engaged in conversation during breakfast.',
      category: 'PROGRESS',
      clientId: client1.id,
      authorId: worker.id
    }
  })
  console.log('✅ Created progress note for', client1.lastName)

  await prisma.note.create({
    data: {
      content: 'Observed patient moving more carefully than usual when getting up from chair. Mentioned mild knee discomfort. No swelling visible. Recommended rest and will monitor tomorrow.',
      category: 'OBSERVATION',
      clientId: client1.id,
      authorId: worker.id
    }
  })
  console.log('✅ Created observation note for', client1.lastName)

  await prisma.note.create({
    data: {
      content: 'Spoke with daughter Sarah regarding upcoming cardiology appointment on Friday. She confirmed she will provide transportation. Patient prefers morning appointment time.',
      category: 'COMMUNICATION',
      clientId: client1.id,
      authorId: worker.id
    }
  })
  console.log('✅ Created communication note for', client1.lastName)

  // Create notes for client2 (Robert Smith)
  await prisma.note.create({
    data: {
      content: 'Blood pressure check completed. Reading: 118/76. Patient feeling well, no complaints. Medication compliance excellent.',
      category: 'PROGRESS',
      clientId: client2.id,
      authorId: worker.id
    }
  })
  console.log('✅ Created progress note for', client2.lastName)

  await prisma.note.create({
    data: {
      content: 'Patient enjoyed 20-minute walk in the garden. Good mobility, steady gait. Weather was pleasant and patient expressed appreciation for the fresh air.',
      category: 'GENERAL',
      clientId: client2.id,
      authorId: worker.id
    }
  })
  console.log('✅ Created general note for', client2.lastName)

  console.log('🎉 Seeding complete!')
  console.log('\n📝 Test credentials:')
  console.log('Worker: worker@bloom.com / SecurePass123')
  console.log('Admin:  admin@bloom.com / AdminPass123')
  console.log('\n📊 Seeded data:')
  console.log('- 2 users (1 worker, 1 admin)')
  console.log('- 2 clients')
  console.log('- 4 tasks (3 for Mary, 1 for Robert)')
  console.log('- 1 task completion')
  console.log('- 5 notes (3 for Mary, 2 for Robert)')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })