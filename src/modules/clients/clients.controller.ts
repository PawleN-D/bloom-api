import { FastifyRequest, FastifyReply } from 'fastify'
import { ClientsService } from './clients.service'

const clientsService = new ClientsService()

interface CreateClientBody {
  firstName: string
  lastName: string
  dateOfBirth?: string
  address?: string
  phone?: string
  email?: string
  conditions?: string[]
  allergies?: string[]
  carePlan?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelation?: string
}

export async function listClients(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const clients = await clientsService.getClients(request, request.query)

    return reply.status(200).send({
      success: true,
      data: clients
    })
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    })
  }
}

export async function getClient(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } = request.params as { id: string }
    const client = await clientsService.getClient(request, id)

    return reply.status(200).send({
      success: true,
      data: client
    })
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    })
  }
}

export async function createClient(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const data = request.body as CreateClientBody

    const clientData = {
      ...data,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      conditions: data.conditions ? JSON.stringify(data.conditions) : undefined,
      allergies: data.allergies ? JSON.stringify(data.allergies) : undefined
    }

    const client = await clientsService.createClient(request, clientData)

    return reply.status(201).send({
      success: true,
      data: client
    })
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    })
  }
}

export async function updateClient(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } = request.params as { id: string }
    const data = request.body as Partial<CreateClientBody>

    const clientData = {
      ...data,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      conditions: data.conditions ? JSON.stringify(data.conditions) : undefined,
      allergies: data.allergies ? JSON.stringify(data.allergies) : undefined
    }

    const client = await clientsService.updateClient(request, id, clientData)

    return reply.status(200).send({
      success: true,
      data: client
    })
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    })
  }
}

export async function deleteClient(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } = request.params as { id: string }
    const result = await clientsService.deleteClient(request, id)

    return reply.status(200).send({
      success: true,
      ...result
    })
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    })
  }
}
