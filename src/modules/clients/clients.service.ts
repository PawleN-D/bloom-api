import { prisma } from '../../shared/database/prisma'

interface CreateClientInput {
  firstName: string
  lastName: string
  dateOfBirth?: Date
  address?: string
  phone?: string
  email?: string
  conditions?: string // JSON string
  allergies?: string // JSON string
  carePlan?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelation?: string
}

interface UpdateClientInput {
  firstName?: string
  lastName?: string
  dateOfBirth?: Date
  address?: string
  phone?: string
  email?: string
  conditions?: string
  allergies?: string
  carePlan?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelation?: string
}

export class ClientsService {
  async createClient(data: CreateClientInput) {
    return await prisma.client.create({
      data
    })
  }

  async getClientsForWorker(workerId: string) {
    return await prisma.client.findMany({
      where: {
        isActive: true,
        assignments: {
          some: {
            userId: workerId,
            isActive: true
          }
        }
      },
      orderBy: {
        lastName: 'asc'
      }
    })
  }

  async getClientById(clientId: string) {
    return await prisma.client.findUnique({
      where: { id: clientId }
    })
  }

  async updateClient(clientId: string, data: UpdateClientInput) {
    return await prisma.client.update({
      where: { id: clientId },
      data
    })
  }

  async deleteClient(clientId: string) {
    return await prisma.client.update({
      where: { id: clientId },
      data: { isActive: false }
    })
  }
}