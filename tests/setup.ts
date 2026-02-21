import { prisma } from '../src/shared/database/prisma'
import { setDatabaseRequestContext } from '../src/shared/database/request-context'

jest.setTimeout(120000)

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
  // Clean database after each test in one statement to avoid slow multi-transaction teardown.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "task_completions",
      "medication_administrations",
      "tasks",
      "notes",
      "incidents",
      "audit_events",
      "compliance_alerts",
      "audit_access_logs",
      "security_logs",
      "email_logs",
      "files",
      "assignments",
      "support_notes",
      "support_tickets",
      "invoice_line_items",
      "invoices",
      "discount_redemptions",
      "subscriptions",
      "clients",
      "users",
      "OrganizationFeature",
      "Feature",
      "Organization",
      "discounts"
    RESTART IDENTITY CASCADE
  `)
})

export { prisma }
