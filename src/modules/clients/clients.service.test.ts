import { ClientsService } from './clients.service'
import { prisma } from '../../../tests/setup'
import { UserRole } from '@prisma/client'
import { buildRequest, createClient, createOrganization, createUser } from '../../../tests/helpers'

describe('ClientsService', () => {
  let clientsService: ClientsService
  let org1: any
  let org2: any
  let user1: any
  let request1: any

  beforeEach(async () => {
    clientsService = new ClientsService()

    org1 = await createOrganization({ name: 'Org One' })
    org2 = await createOrganization({ name: 'Org Two' })

    user1 = await createUser({
      organizationId: org1.id,
      role: UserRole.ADMIN,
    })

    request1 = buildRequest({ user: user1, organization: org1 })
  })

  describe('createClient', () => {
    it('should create a new client scoped to organization', async () => {
      const clientData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+27123456789',
      }

      const client = await clientsService.createClient(request1, clientData)

      expect(client).toBeDefined()
      expect(client.firstName).toBe('John')
      expect(client.lastName).toBe('Doe')
      expect(client.organizationId).toBe(org1.id)
      expect(client.isActive).toBe(true)
    })
  })

  describe('getClients', () => {
    it('should return only clients for the current organization', async () => {
      await createClient({ organizationId: org1.id, firstName: 'Org1', lastName: 'Client' })
      await createClient({ organizationId: org2.id, firstName: 'Org2', lastName: 'Client' })

      const clients = await clientsService.getClients(request1, {})

      expect(clients).toHaveLength(1)
      expect(clients[0].organizationId).toBe(org1.id)
    })
  })

  describe('updateClient', () => {
    it('should not allow updating client from another organization', async () => {
      const otherOrgClient = await createClient({
        organizationId: org2.id,
        firstName: 'Other',
        lastName: 'Org',
      })

      await expect(
        clientsService.updateClient(request1, otherOrgClient.id, { firstName: 'Blocked' })
      ).rejects.toThrow('Client not found')
    })
  })

  describe('deleteClient', () => {
    it('should soft delete client (set isActive to false)', async () => {
      const client = await createClient({
        organizationId: org1.id,
        firstName: 'John',
        lastName: 'Doe',
      })

      await clientsService.deleteClient(request1, client.id)

      const deleted = await prisma.client.findUnique({
        where: { id: client.id },
      })

      expect(deleted).toBeDefined()
      expect(deleted?.isActive).toBe(false)
    })
  })
})
