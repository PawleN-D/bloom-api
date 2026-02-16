import { prisma } from '../src/shared/database/prisma'
import { setDatabaseRequestContext } from '../src/shared/database/request-context'

const bypassContext = {
  tenantId: null,
  userId: null,
  bypassRls: true,
}

beforeAll(async () => {
  setDatabaseRequestContext(bypassContext)
  // Connect to test database
  await prisma.$connect()
})

afterAll(async () => {
  setDatabaseRequestContext(bypassContext)
  // Clean up and disconnect
  await prisma.$disconnect()
})

afterEach(async () => {
  setDatabaseRequestContext(bypassContext)
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
