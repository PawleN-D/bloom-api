import { PrismaClient, SubscriptionPlan, UserRole } from '@prisma/client'
import bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const now = new Date()
  const org1Id = 'org_test_1'
  const org2Id = 'org_test_2'

  const org1 = await prisma.organization.upsert({
    where: { id: org1Id },
    update: {
      name: 'Test Organization 1',
      slug: 'test-org-1',
      plan: SubscriptionPlan.STARTER,
      active: true,
      suspended: false,
      updatedAt: now,
    },
    create: {
      id: org1Id,
      name: 'Test Organization 1',
      slug: 'test-org-1',
      plan: SubscriptionPlan.STARTER,
      active: true,
      suspended: false,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Created org:', org1.name)

  const org2 = await prisma.organization.upsert({
    where: { id: org2Id },
    update: {
      name: 'Test Organization 2',
      slug: 'test-org-2',
      plan: SubscriptionPlan.PROFESSIONAL,
      active: true,
      suspended: false,
      updatedAt: now,
    },
    create: {
      id: org2Id,
      name: 'Test Organization 2',
      slug: 'test-org-2',
      plan: SubscriptionPlan.PROFESSIONAL,
      active: true,
      suspended: false,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Created org:', org2.name)

  const superPassword = await bcrypt.hash('SuperPass123', 10)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@bloom.com' },
    update: {
      password: superPassword,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      updatedAt: now,
    },
    create: {
      id: 'user_super_admin',
      email: 'superadmin@bloom.com',
      password: superPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Created super admin:', superAdmin.email)

  const adminPassword = await bcrypt.hash('Password123', 10)
  const org1Admin = await prisma.user.upsert({
    where: { email: 'admin1@org1.com' },
    update: {
      password: adminPassword,
      role: UserRole.ADMIN,
      organizationId: org1.id,
      isActive: true,
      updatedAt: now,
    },
    create: {
      id: 'user_org1_admin',
      email: 'admin1@org1.com',
      password: adminPassword,
      firstName: 'Org1',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      organizationId: org1.id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Created org1 admin:', org1Admin.email)

  const org2Admin = await prisma.user.upsert({
    where: { email: 'admin2@org2.com' },
    update: {
      password: adminPassword,
      role: UserRole.ADMIN,
      organizationId: org2.id,
      isActive: true,
      updatedAt: now,
    },
    create: {
      id: 'user_org2_admin',
      email: 'admin2@org2.com',
      password: adminPassword,
      firstName: 'Org2',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      organizationId: org2.id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Created org2 admin:', org2Admin.email)

  const workerPassword = await bcrypt.hash('Password123', 10)
  const worker = await prisma.user.upsert({
    where: { email: 'worker1@org1.com' },
    update: {
      password: workerPassword,
      role: UserRole.WORKER,
      organizationId: org1.id,
      isActive: true,
      updatedAt: now,
    },
    create: {
      id: 'user_org1_worker',
      email: 'worker1@org1.com',
      password: workerPassword,
      firstName: 'John',
      lastName: 'Worker',
      role: UserRole.WORKER,
      organizationId: org1.id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Created worker:', worker.email)

  const client1 = await prisma.client.upsert({
    where: { id: 'org1_client_1' },
    update: {
      organizationId: org1.id,
      updatedAt: now,
    },
    create: {
      id: 'org1_client_1',
      organizationId: org1.id,
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
      emergencyContactRelation: 'Son',
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Created client:', client1.firstName, client1.lastName)

  const client2 = await prisma.client.upsert({
    where: { id: 'org2_client_1' },
    update: {
      organizationId: org2.id,
      updatedAt: now,
    },
    create: {
      id: 'org2_client_1',
      organizationId: org2.id,
      firstName: 'Robert',
      lastName: 'Smith',
      dateOfBirth: new Date('1938-07-22'),
      phone: '+27111222333',
      address: '456 Oak Avenue, Cape Town',
      conditions: JSON.stringify(['Hypertension']),
      carePlan: 'Regular blood pressure monitoring',
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Created client:', client2.firstName, client2.lastName)

  await prisma.assignment.upsert({
    where: {
      userId_clientId: {
        userId: worker.id,
        clientId: client1.id,
      },
    },
    update: {},
    create: {
      id: 'assignment_org1_worker_client1',
      userId: worker.id,
      clientId: client1.id,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Assigned', client1.lastName, 'to', worker.firstName)

  await prisma.assignment.upsert({
    where: {
      userId_clientId: {
        userId: worker.id,
        clientId: client2.id,
      },
    },
    update: {},
    create: {
      id: 'assignment_org1_worker_client2',
      userId: worker.id,
      clientId: client2.id,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Assigned', client2.lastName, 'to', worker.firstName)

  const task1 = await prisma.task.upsert({
    where: { id: 'org1_task_1' },
    update: {
      organizationId: org1.id,
      updatedAt: now,
    },
    create: {
      id: 'org1_task_1',
      title: 'Morning medication',
      description: 'Administer blood pressure medication with breakfast',
      category: 'MEDICATION',
      priority: 'HIGH',
      clientId: client1.id,
      organizationId: org1.id,
      isRecurring: true,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Created task:', task1.title)

  const task2 = await prisma.task.upsert({
    where: { id: 'org1_task_2' },
    update: {
      organizationId: org1.id,
      updatedAt: now,
    },
    create: {
      id: 'org1_task_2',
      title: 'Assist with bathing',
      description: 'Help with morning shower and personal care',
      category: 'PERSONAL_CARE',
      priority: 'NORMAL',
      clientId: client1.id,
      organizationId: org1.id,
      isRecurring: true,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Created task:', task2.title)

  const task3 = await prisma.task.upsert({
    where: { id: 'org1_task_3' },
    update: {
      organizationId: org1.id,
      updatedAt: now,
    },
    create: {
      id: 'org1_task_3',
      title: 'Prepare diabetic-friendly lunch',
      description: 'Low sugar, balanced meal',
      category: 'MEAL_PREP',
      priority: 'NORMAL',
      clientId: client1.id,
      organizationId: org1.id,
      isRecurring: true,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Created task:', task3.title)

  const task4 = await prisma.task.upsert({
    where: { id: 'org2_task_1' },
    update: {
      organizationId: org2.id,
      updatedAt: now,
    },
    create: {
      id: 'org2_task_1',
      title: 'Check blood pressure',
      description: 'Monitor and record vital signs',
      category: 'HEALTH_MONITORING',
      priority: 'HIGH',
      clientId: client2.id,
      organizationId: org2.id,
      isRecurring: true,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Created task:', task4.title)

  await prisma.taskCompletion.create({
    data: {
      id: `completion_${randomBytes(8).toString('hex')}`,
      taskId: task1.id,
      completedBy: worker.id,
      notes: 'Medication administered at 9:00 AM. Patient took pills with breakfast. No adverse reactions observed.',
      createdAt: now,
    },
  })
  console.log('Created task completion for:', task1.title)

  await prisma.note.create({
    data: {
      id: `note_${randomBytes(8).toString('hex')}`,
      content: 'Patient completed all morning tasks successfully. Blood pressure was 120/80, within normal range. Took medication without any issues. Patient was in good spirits and engaged in conversation during breakfast.',
      category: 'PROGRESS',
      clientId: client1.id,
      authorId: worker.id,
      organizationId: org1.id,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Created progress note for', client1.lastName)

  await prisma.note.create({
    data: {
      id: `note_${randomBytes(8).toString('hex')}`,
      content: 'Observed patient moving more carefully than usual when getting up from chair. Mentioned mild knee discomfort. No swelling visible. Recommended rest and will monitor tomorrow.',
      category: 'OBSERVATION',
      clientId: client1.id,
      authorId: worker.id,
      organizationId: org1.id,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Created observation note for', client1.lastName)

  await prisma.note.create({
    data: {
      id: `note_${randomBytes(8).toString('hex')}`,
      content: 'Spoke with daughter Sarah regarding upcoming cardiology appointment on Friday. She confirmed she will provide transportation. Patient prefers morning appointment time.',
      category: 'COMMUNICATION',
      clientId: client1.id,
      authorId: worker.id,
      organizationId: org1.id,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Created communication note for', client1.lastName)

  await prisma.note.create({
    data: {
      id: `note_${randomBytes(8).toString('hex')}`,
      content: 'Blood pressure check completed. Reading: 118/76. Patient feeling well, no complaints. Medication compliance excellent.',
      category: 'PROGRESS',
      clientId: client2.id,
      authorId: worker.id,
      organizationId: org2.id,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Created progress note for', client2.lastName)

  await prisma.note.create({
    data: {
      id: `note_${randomBytes(8).toString('hex')}`,
      content: 'Patient enjoyed 20-minute walk in the garden. Good mobility, steady gait. Weather was pleasant and patient expressed appreciation for the fresh air.',
      category: 'GENERAL',
      clientId: client2.id,
      authorId: worker.id,
      organizationId: org2.id,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Created general note for', client2.lastName)

  console.log('Seeding complete')
  console.log('Test credentials:')
  console.log('Super Admin: superadmin@bloom.com / SuperPass123')
  console.log('Org1 Admin:  admin1@org1.com / Password123')
  console.log('Org2 Admin:  admin2@org2.com / Password123')
  console.log('Worker:      worker1@org1.com / Password123')
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
