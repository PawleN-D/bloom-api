import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

beforeAll(async () => {
  // Connect to test database
  await prisma.$connect()
})

afterAll(async () => {
  // Clean up and disconnect
  await prisma.$disconnect()
})

afterEach(async () => {
  // Clean database after each test - delete in correct order to avoid FK constraints
  await prisma.taskCompletion.deleteMany({})
  await prisma.task.deleteMany({})
  await prisma.note.deleteMany({})
  await prisma.file.deleteMany({})
  await prisma.assignment.deleteMany({})
  await prisma.client.deleteMany({})
  await prisma.user.deleteMany({})
  await prisma.organizationFeature.deleteMany({})
  await prisma.feature.deleteMany({})
  await prisma.organization.deleteMany({})
})

export { prisma }
