import { FastifyRequest } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { withTenantIsolation } from '../../shared/middleware/tenant-context';

export class ClientsService {
  
  /**
   * Get all clients for current organization
   */
  async getClients(request: FastifyRequest, filters?: any) {
    const { search, active } = filters || {};
    
    // Build where clause with tenant isolation
    const where = withTenantIsolation(request, {
      isActive: active === 'true' ? true : active === 'false' ? false : undefined,
    });
    
    // Add search filter if provided
    if (search) {
      (where as any).OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    // Simplified - no includes for now to avoid relation errors
    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    
    return clients;
  }
  
  /**
   * Get single client (with tenant isolation)
   */
  async getClient(request: FastifyRequest, id: string) {
    // Simplified - no includes for now
    const client = await prisma.client.findUnique({
      where: withTenantIsolation(request, { id }),
    });
    
    if (!client) {
      throw new Error('Client not found');
    }
    
    return client;
  }
  
  /**
   * Create client
   */
  async createClient(request: FastifyRequest, data: any) {
    const org = request.organization;
    
    if (!org) {
      throw new Error('Organization required');
    }
    
    // Generate ID if not provided
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
  
  /**
   * Update client (with tenant isolation check)
   */
  async updateClient(request: FastifyRequest, id: string, data: any) {
    // Verify client belongs to organization
    const existing = await prisma.client.findUnique({
      where: withTenantIsolation(request, { id }),
    });
    
    if (!existing) {
      throw new Error('Client not found');
    }
    
    // Build update data
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
  
  /**
   * Delete client (soft delete with tenant isolation)
   */
  async deleteClient(request: FastifyRequest, id: string) {
    // Verify client belongs to organization
    const existing = await prisma.client.findUnique({
      where: withTenantIsolation(request, { id }),
    });
    
    if (!existing) {
      throw new Error('Client not found');
    }
    
    // Soft delete
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
