import { FastifyRequest } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { withTenantIsolation } from '../../shared/middleware/tenant-context';

export class ClientsService {
  
  async getClients(request: FastifyRequest, filters?: any) {
    const { search, active } = filters || {};
    
    const where = withTenantIsolation(request, {
      isActive: active === 'true' ? true : active === 'false' ? false : undefined,
    });
    
    if (search) {
      (where as any).OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    
    return clients;
  }
  
  async getClient(request: FastifyRequest, id: string) {
    const client = await prisma.client.findUnique({
      where: withTenantIsolation(request, { id }),
    });
    
    if (!client) {
      throw new Error('Client not found');
    }
    
    return client;
  }
  
  async createClient(request: FastifyRequest, data: any) {
    const org = request.organization;
    
    if (!org) {
      throw new Error('Organization required');
    }
    
    const clientId = data.id || require('crypto').randomBytes(16).toString('hex');
    
    const client = await prisma.client.create({
      data: {
        id: clientId,
        organizationId: org.id,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        conditions: data.conditions || null,
        allergies: data.allergies || null,
        carePlan: data.carePlan || null,
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
        emergencyContactRelation: data.emergencyContactRelation || null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    });
    
    return client;
  }
  
  async updateClient(request: FastifyRequest, id: string, data: any) {
    const existing = await prisma.client.findUnique({
      where: withTenantIsolation(request, { id }),
    });
    
    if (!existing) {
      throw new Error('Client not found');
    }
    
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.dateOfBirth !== undefined) {
      updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    }
    if (data.address !== undefined) updateData.address = data.address;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.conditions !== undefined) updateData.conditions = data.conditions;
    if (data.allergies !== undefined) updateData.allergies = data.allergies;
    if (data.carePlan !== undefined) updateData.carePlan = data.carePlan;
    if (data.emergencyContactName !== undefined) updateData.emergencyContactName = data.emergencyContactName;
    if (data.emergencyContactPhone !== undefined) updateData.emergencyContactPhone = data.emergencyContactPhone;
    if (data.emergencyContactRelation !== undefined) updateData.emergencyContactRelation = data.emergencyContactRelation;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    
    const client = await prisma.client.update({
      where: { id },
      data: updateData,
    });
    
    return client;
  }
  
  async deleteClient(request: FastifyRequest, id: string) {
    const existing = await prisma.client.findUnique({
      where: withTenantIsolation(request, { id }),
    });
    
    if (!existing) {
      throw new Error('Client not found');
    }
    
    await prisma.client.update({
      where: { id },
      data: { 
        isActive: false,
        updatedAt: new Date(),
      },
    });
    
    return { message: 'Client deleted successfully' };
  }
}
