import { ClientsService } from './clients.service'
import { prisma } from '../../../tests/setup'
import { UserRole } from '@prisma/client'

describe('ClientsService', () => {
  let clientsService: ClientsService
  let testWorker: any

  beforeEach(async () => {
    clientsService = new ClientsService()

    // Create test worker
    testWorker = await prisma.user.create({
      data: {
        email: 'worker@test.com',
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'Worker',
        role: UserRole.WORKER
      }
    })
  })

  describe('createClient', () => {
    it('should create a new client', async () => {
      const clientData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+27123456789'
      }

      const client = await clientsService.createClient(clientData)

      expect(client).toBeDefined()
      expect(client.firstName).toBe('John')
      expect(client.lastName).toBe('Doe')
      expect(client.isActive).toBe(true)
    })

    it('should create client with optional fields', async () => {
      const clientData = {
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: new Date('1950-01-01'),
        address: '123 Main St',
        conditions: JSON.stringify(['Diabetes', 'Hypertension']),
        allergies: JSON.stringify(['Penicillin'])
      }

      const client = await clientsService.createClient(clientData)

      expect(client.dateOfBirth).toEqual(new Date('1950-01-01'))
      expect(client.conditions).toBe(JSON.stringify(['Diabetes', 'Hypertension']))
    })
  })

  describe('getClientsForWorker', () => {
    it('should return only assigned clients for worker', async () => {
      // Create clients
      const client1 = await prisma.client.create({
        data: { firstName: 'Client', lastName: 'One' }
      })
      const client2 = await prisma.client.create({
        data: { firstName: 'Client', lastName: 'Two' }
      })
      const client3 = await prisma.client.create({
        data: { firstName: 'Client', lastName: 'Three' }
      })

      // Assign only client1 and client2 to worker
      await prisma.assignment.create({
        data: { userId: testWorker.id, clientId: client1.id }
      })
      await prisma.assignment.create({
        data: { userId: testWorker.id, clientId: client2.id }
      })

      const clients = await clientsService.getClientsForWorker(testWorker.id)

      expect(clients).toHaveLength(2)
      expect(clients.map(c => c.id)).toContain(client1.id)
      expect(clients.map(c => c.id)).toContain(client2.id)
      expect(clients.map(c => c.id)).not.toContain(client3.id)
    })

    it('should return empty array if worker has no assignments', async () => {
      const clients = await clientsService.getClientsForWorker(testWorker.id)

      expect(clients).toEqual([])
    })

    it('should not return inactive clients', async () => {
      // Create active and inactive clients
      const activeClient = await prisma.client.create({
        data: { firstName: 'Active', lastName: 'Client', isActive: true }
      })
      const inactiveClient = await prisma.client.create({
        data: { firstName: 'Inactive', lastName: 'Client', isActive: false }
      })

      // Assign both to worker
      await prisma.assignment.create({
        data: { userId: testWorker.id, clientId: activeClient.id }
      })
      await prisma.assignment.create({
        data: { userId: testWorker.id, clientId: inactiveClient.id }
      })

      const clients = await clientsService.getClientsForWorker(testWorker.id)

      expect(clients).toHaveLength(1)
      expect(clients[0].id).toBe(activeClient.id)
    })
  })

  describe('getClientById', () => {
    it('should return client by id', async () => {
      const client = await prisma.client.create({
        data: { firstName: 'John', lastName: 'Doe' }
      })

      const found = await clientsService.getClientById(client.id)

      expect(found).toBeDefined()
      expect(found?.id).toBe(client.id)
      expect(found?.firstName).toBe('John')
    })

    it('should return null for non-existent client', async () => {
      const found = await clientsService.getClientById('non-existent-id')

      expect(found).toBeNull()
    })
  })

  describe('updateClient', () => {
    it('should update client fields', async () => {
      const client = await prisma.client.create({
        data: { firstName: 'John', lastName: 'Doe' }
      })

      const updated = await clientsService.updateClient(client.id, {
        firstName: 'Jane',
        phone: '+27987654321'
      })

      expect(updated.firstName).toBe('Jane')
      expect(updated.lastName).toBe('Doe') // Unchanged
      expect(updated.phone).toBe('+27987654321')
    })
  })

  describe('deleteClient', () => {
    it('should soft delete client (set isActive to false)', async () => {
      const client = await prisma.client.create({
        data: { firstName: 'John', lastName: 'Doe', isActive: true }
      })

      await clientsService.deleteClient(client.id)

      const deleted = await prisma.client.findUnique({
        where: { id: client.id }
      })

      expect(deleted).toBeDefined()
      expect(deleted?.isActive).toBe(false)
    })
  })
})