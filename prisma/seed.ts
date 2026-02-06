import {
  PrismaClient,
  FeatureCategory,
  NoteCategory,
  SubscriptionPlan,
  SubscriptionStatus,
  TaskCategory,
  TaskCompletionStatus,
  TaskPriority,
  UserRole,
  UserStatus,
} from '@prisma/client'
import bcrypt from 'bcrypt'
import { DEFAULT_BILLING_CYCLE_DAYS, PLAN_CATALOG } from '../src/shared/constants/plans'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const now = new Date()
  const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000)
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  const org1Id = 'org_test_1'
  const org2Id = 'org_test_2'

  const org1 = await prisma.organization.upsert({
    where: { id: org1Id },
    update: {
      name: 'Test Organization 1',
      slug: 'test-org-1',
      subdomain: 'org1',
      primaryColor: '#0F766E',
      plan: SubscriptionPlan.STARTER,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      billingEmail: 'billing@org1.com',
      maxUsers: 8,
      maxClients: 30,
      active: true,
      suspended: false,
      trialEndsAt: daysFromNow(14),
      updatedAt: now,
    },
    create: {
      id: org1Id,
      name: 'Test Organization 1',
      slug: 'test-org-1',
      subdomain: 'org1',
      primaryColor: '#0F766E',
      plan: SubscriptionPlan.STARTER,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      billingEmail: 'billing@org1.com',
      maxUsers: 8,
      maxClients: 30,
      active: true,
      suspended: false,
      trialEndsAt: daysFromNow(14),
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
      subdomain: 'org2',
      primaryColor: '#1D4ED8',
      plan: SubscriptionPlan.PROFESSIONAL,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      billingEmail: 'billing@org2.com',
      maxUsers: 25,
      maxClients: 120,
      active: true,
      suspended: false,
      trialEndsAt: null,
      updatedAt: now,
    },
    create: {
      id: org2Id,
      name: 'Test Organization 2',
      slug: 'test-org-2',
      subdomain: 'org2',
      primaryColor: '#1D4ED8',
      plan: SubscriptionPlan.PROFESSIONAL,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      billingEmail: 'billing@org2.com',
      maxUsers: 25,
      maxClients: 120,
      active: true,
      suspended: false,
      trialEndsAt: null,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Created org:', org2.name)

  const billingPeriodEnd = daysFromNow(DEFAULT_BILLING_CYCLE_DAYS)

  await prisma.subscription.upsert({
    where: { organizationId: org1.id },
    update: {
      plan: org1.plan,
      status: SubscriptionStatus.ACTIVE,
      priceCents: PLAN_CATALOG[org1.plan].priceCents,
      currency: PLAN_CATALOG[org1.plan].currency,
      currentPeriodStart: now,
      currentPeriodEnd: billingPeriodEnd,
      updatedAt: now,
    },
    create: {
      id: 'sub_org1',
      organizationId: org1.id,
      plan: org1.plan,
      status: SubscriptionStatus.ACTIVE,
      priceCents: PLAN_CATALOG[org1.plan].priceCents,
      currency: PLAN_CATALOG[org1.plan].currency,
      currentPeriodStart: now,
      currentPeriodEnd: billingPeriodEnd,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    },
  })

  await prisma.subscription.upsert({
    where: { organizationId: org2.id },
    update: {
      plan: org2.plan,
      status: SubscriptionStatus.ACTIVE,
      priceCents: PLAN_CATALOG[org2.plan].priceCents,
      currency: PLAN_CATALOG[org2.plan].currency,
      currentPeriodStart: now,
      currentPeriodEnd: billingPeriodEnd,
      updatedAt: now,
    },
    create: {
      id: 'sub_org2',
      organizationId: org2.id,
      plan: org2.plan,
      status: SubscriptionStatus.ACTIVE,
      priceCents: PLAN_CATALOG[org2.plan].priceCents,
      currency: PLAN_CATALOG[org2.plan].currency,
      currentPeriodStart: now,
      currentPeriodEnd: billingPeriodEnd,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    },
  })

  const featureSeed = [
    {
      key: 'core_clients',
      name: 'Client Management',
      description: 'Create and manage client profiles',
      category: FeatureCategory.CORE,
      availableInPlans: [
        SubscriptionPlan.FREE,
        SubscriptionPlan.STARTER,
        SubscriptionPlan.PROFESSIONAL,
        SubscriptionPlan.ENTERPRISE,
      ],
      betaFeature: false,
      comingSoon: false,
      defaultEnabled: true,
    },
    {
      key: 'core_tasks',
      name: 'Task Management',
      description: 'Create and track care tasks',
      category: FeatureCategory.CORE,
      availableInPlans: [
        SubscriptionPlan.FREE,
        SubscriptionPlan.STARTER,
        SubscriptionPlan.PROFESSIONAL,
        SubscriptionPlan.ENTERPRISE,
      ],
      betaFeature: false,
      comingSoon: false,
      defaultEnabled: true,
    },
    {
      key: 'core_notes',
      name: 'Care Notes',
      description: 'Record progress notes and observations',
      category: FeatureCategory.CORE,
      availableInPlans: [
        SubscriptionPlan.FREE,
        SubscriptionPlan.STARTER,
        SubscriptionPlan.PROFESSIONAL,
        SubscriptionPlan.ENTERPRISE,
      ],
      betaFeature: false,
      comingSoon: false,
      defaultEnabled: true,
    },
    {
      key: 'core_assignments',
      name: 'Assignments',
      description: 'Assign workers to clients',
      category: FeatureCategory.CORE,
      availableInPlans: [
        SubscriptionPlan.FREE,
        SubscriptionPlan.STARTER,
        SubscriptionPlan.PROFESSIONAL,
        SubscriptionPlan.ENTERPRISE,
      ],
      betaFeature: false,
      comingSoon: false,
      defaultEnabled: true,
    },
    {
      key: 'compliance_handover',
      name: 'Handover Reports',
      description: 'Generate significant handover summaries',
      category: FeatureCategory.COMPLIANCE,
      availableInPlans: [
        SubscriptionPlan.STARTER,
        SubscriptionPlan.PROFESSIONAL,
        SubscriptionPlan.ENTERPRISE,
      ],
      betaFeature: false,
      comingSoon: false,
      defaultEnabled: false,
    },
    {
      key: 'compliance_audit_log',
      name: 'Audit Log Export',
      description: 'Export immutable compliance audit logs',
      category: FeatureCategory.COMPLIANCE,
      availableInPlans: [SubscriptionPlan.PROFESSIONAL, SubscriptionPlan.ENTERPRISE],
      betaFeature: false,
      comingSoon: false,
      defaultEnabled: false,
    },
    {
      key: 'advanced_analytics',
      name: 'Advanced Analytics',
      description: 'Analytics dashboards and trends',
      category: FeatureCategory.ADVANCED,
      availableInPlans: [SubscriptionPlan.PROFESSIONAL, SubscriptionPlan.ENTERPRISE],
      betaFeature: false,
      comingSoon: false,
      defaultEnabled: false,
    },
    {
      key: 'integrations_r2',
      name: 'Cloud Storage Integrations',
      description: 'Cloudflare R2 file storage integration',
      category: FeatureCategory.INTEGRATIONS,
      availableInPlans: [SubscriptionPlan.PROFESSIONAL, SubscriptionPlan.ENTERPRISE],
      betaFeature: false,
      comingSoon: false,
      defaultEnabled: false,
    },
    {
      key: 'ai_note_summaries',
      name: 'AI Note Summaries',
      description: 'AI-generated summaries for notes',
      category: FeatureCategory.AI,
      availableInPlans: [SubscriptionPlan.ENTERPRISE],
      betaFeature: true,
      comingSoon: true,
      defaultEnabled: false,
    },
    {
      key: 'enterprise_sso',
      name: 'Enterprise SSO',
      description: 'Single sign-on with SAML/OIDC',
      category: FeatureCategory.ENTERPRISE,
      availableInPlans: [SubscriptionPlan.ENTERPRISE],
      betaFeature: false,
      comingSoon: false,
      defaultEnabled: false,
    },
  ]

  const featuresByKey: Record<string, any> = {}
  for (const feature of featureSeed) {
    const record = await prisma.feature.upsert({
      where: { key: feature.key },
      update: {
        name: feature.name,
        description: feature.description,
        category: feature.category,
        availableInPlans: feature.availableInPlans,
        betaFeature: feature.betaFeature,
        comingSoon: feature.comingSoon,
        defaultEnabled: feature.defaultEnabled,
        updatedAt: now,
      },
      create: {
        id: `feature_${feature.key}`,
        key: feature.key,
        name: feature.name,
        description: feature.description,
        category: feature.category,
        availableInPlans: feature.availableInPlans,
        betaFeature: feature.betaFeature,
        comingSoon: feature.comingSoon,
        defaultEnabled: feature.defaultEnabled,
        createdAt: now,
        updatedAt: now,
      },
    })
    featuresByKey[record.key] = record
  }
  console.log(`Seeded ${featureSeed.length} features`)

  await prisma.organizationFeature.upsert({
    where: {
      organizationId_featureId: {
        organizationId: org1.id,
        featureId: featuresByKey.compliance_handover.id,
      },
    },
    update: {
      enabled: true,
      config: {
        windowHours: 12,
        includeIncidents: true,
      },
      updatedAt: now,
    },
    create: {
      id: 'org1_feature_handover',
      organizationId: org1.id,
      featureId: featuresByKey.compliance_handover.id,
      enabled: true,
      config: {
        windowHours: 12,
        includeIncidents: true,
      },
      createdAt: now,
      updatedAt: now,
    },
  })

  await prisma.organizationFeature.upsert({
    where: {
      organizationId_featureId: {
        organizationId: org2.id,
        featureId: featuresByKey.advanced_analytics.id,
      },
    },
    update: {
      enabled: true,
      config: {
        dashboards: ['care_delivery', 'incident_rate'],
      },
      updatedAt: now,
    },
    create: {
      id: 'org2_feature_analytics',
      organizationId: org2.id,
      featureId: featuresByKey.advanced_analytics.id,
      enabled: true,
      config: {
        dashboards: ['care_delivery', 'incident_rate'],
      },
      createdAt: now,
      updatedAt: now,
    },
  })

  await prisma.organizationFeature.upsert({
    where: {
      organizationId_featureId: {
        organizationId: org2.id,
        featureId: featuresByKey.integrations_r2.id,
      },
    },
    update: {
      enabled: true,
      config: {
        provider: 'cloudflare',
        bucket: 'bloom-uat',
      },
      updatedAt: now,
    },
    create: {
      id: 'org2_feature_r2',
      organizationId: org2.id,
      featureId: featuresByKey.integrations_r2.id,
      enabled: true,
      config: {
        provider: 'cloudflare',
        bucket: 'bloom-uat',
      },
      createdAt: now,
      updatedAt: now,
    },
  })

  await prisma.organizationFeature.upsert({
    where: {
      organizationId_featureId: {
        organizationId: org2.id,
        featureId: featuresByKey.compliance_audit_log.id,
      },
    },
    update: {
      enabled: false,
      config: {
        retentionDays: 365,
      },
      updatedAt: now,
    },
    create: {
      id: 'org2_feature_audit',
      organizationId: org2.id,
      featureId: featuresByKey.compliance_audit_log.id,
      enabled: false,
      config: {
        retentionDays: 365,
      },
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Seeded organization features')

  const superPassword = await bcrypt.hash('SuperPass123', 10)
  const defaultPassword = await bcrypt.hash('Password123', 10)
  const defaultPinHash = await bcrypt.hash('1234', 10)

  const users = [
    {
      id: 'user_super_admin',
      email: 'superadmin@bloom.com',
      passwordHash: superPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.SUPER_ADMIN,
      organizationId: null,
    },
    {
      id: 'user_org1_owner',
      email: 'owner1@org1.com',
      passwordHash: defaultPassword,
      firstName: 'Olivia',
      lastName: 'Owner',
      role: UserRole.ORG_OWNER,
      organizationId: org1.id,
    },
    {
      id: 'user_org1_admin',
      email: 'admin1@org1.com',
      passwordHash: defaultPassword,
      firstName: 'Avery',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      organizationId: org1.id,
    },
    {
      id: 'user_org1_manager',
      email: 'manager1@org1.com',
      passwordHash: defaultPassword,
      firstName: 'Morgan',
      lastName: 'Manager',
      role: UserRole.MANAGER,
      organizationId: org1.id,
    },
    {
      id: 'user_org1_worker1',
      email: 'worker1@org1.com',
      passwordHash: defaultPassword,
      firstName: 'John',
      lastName: 'Worker',
      role: UserRole.WORKER,
      organizationId: org1.id,
    },
    {
      id: 'user_org1_worker2',
      email: 'worker2@org1.com',
      passwordHash: defaultPassword,
      firstName: 'Lena',
      lastName: 'Care',
      role: UserRole.WORKER,
      organizationId: org1.id,
    },
    {
      id: 'user_org2_owner',
      email: 'owner2@org2.com',
      passwordHash: defaultPassword,
      firstName: 'Oscar',
      lastName: 'Owner',
      role: UserRole.ORG_OWNER,
      organizationId: org2.id,
    },
    {
      id: 'user_org2_admin',
      email: 'admin2@org2.com',
      passwordHash: defaultPassword,
      firstName: 'Amina',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      organizationId: org2.id,
    },
    {
      id: 'user_org2_manager',
      email: 'manager2@org2.com',
      passwordHash: defaultPassword,
      firstName: 'Marco',
      lastName: 'Manager',
      role: UserRole.MANAGER,
      organizationId: org2.id,
    },
    {
      id: 'user_org2_worker1',
      email: 'worker1@org2.com',
      passwordHash: defaultPassword,
      firstName: 'Priya',
      lastName: 'Care',
      role: UserRole.WORKER,
      organizationId: org2.id,
    },
  ]

  const usersByEmail: Record<string, any> = {}
  for (const user of users) {
    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        passwordHash: user.passwordHash,
        pinHash: defaultPinHash,
        status: UserStatus.ACTIVE,
        invitationToken: null,
        tokenExpires: null,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        isActive: true,
        updatedAt: now,
      },
      create: {
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        pinHash: defaultPinHash,
        status: UserStatus.ACTIVE,
        invitationToken: null,
        tokenExpires: null,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    })
    usersByEmail[user.email] = record
  }
  console.log('Created users')

  const client1 = await prisma.client.upsert({
    where: { id: 'org1_client_1' },
    update: {
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
      createdAt: daysAgo(60),
      updatedAt: now,
    },
  })

  const client2 = await prisma.client.upsert({
    where: { id: 'org1_client_2' },
    update: {
      organizationId: org1.id,
      firstName: 'Carlos',
      lastName: 'Diaz',
      dateOfBirth: new Date('1951-11-02'),
      phone: '+27112223344',
      email: 'carlos@example.com',
      address: '45 Kloof Street, Cape Town',
      conditions: JSON.stringify(['COPD']),
      allergies: JSON.stringify(['Sulfa']),
      carePlan: 'Twice-daily inhaler and mobility support',
      emergencyContactName: 'Elena Diaz',
      emergencyContactPhone: '+27981112233',
      emergencyContactRelation: 'Spouse',
      updatedAt: now,
    },
    create: {
      id: 'org1_client_2',
      organizationId: org1.id,
      firstName: 'Carlos',
      lastName: 'Diaz',
      dateOfBirth: new Date('1951-11-02'),
      phone: '+27112223344',
      email: 'carlos@example.com',
      address: '45 Kloof Street, Cape Town',
      conditions: JSON.stringify(['COPD']),
      allergies: JSON.stringify(['Sulfa']),
      carePlan: 'Twice-daily inhaler and mobility support',
      emergencyContactName: 'Elena Diaz',
      emergencyContactPhone: '+27981112233',
      emergencyContactRelation: 'Spouse',
      createdAt: daysAgo(45),
      updatedAt: now,
    },
  })

  const client3 = await prisma.client.upsert({
    where: { id: 'org2_client_1' },
    update: {
      organizationId: org2.id,
      firstName: 'Robert',
      lastName: 'Smith',
      dateOfBirth: new Date('1938-07-22'),
      phone: '+27111222333',
      address: '456 Oak Avenue, Cape Town',
      conditions: JSON.stringify(['Hypertension']),
      carePlan: 'Regular blood pressure monitoring',
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
      createdAt: daysAgo(70),
      updatedAt: now,
    },
  })

  const client4 = await prisma.client.upsert({
    where: { id: 'org2_client_2' },
    update: {
      organizationId: org2.id,
      firstName: 'Aisha',
      lastName: 'Khan',
      dateOfBirth: new Date('1942-01-09'),
      phone: '+27215556677',
      email: 'aisha@example.com',
      address: '12 Long Street, Cape Town',
      conditions: JSON.stringify(['Osteoarthritis']),
      allergies: JSON.stringify(['Latex']),
      carePlan: 'Pain management and mobility exercises',
      emergencyContactName: 'Sara Khan',
      emergencyContactPhone: '+27880001122',
      emergencyContactRelation: 'Daughter',
      updatedAt: now,
    },
    create: {
      id: 'org2_client_2',
      organizationId: org2.id,
      firstName: 'Aisha',
      lastName: 'Khan',
      dateOfBirth: new Date('1942-01-09'),
      phone: '+27215556677',
      email: 'aisha@example.com',
      address: '12 Long Street, Cape Town',
      conditions: JSON.stringify(['Osteoarthritis']),
      allergies: JSON.stringify(['Latex']),
      carePlan: 'Pain management and mobility exercises',
      emergencyContactName: 'Sara Khan',
      emergencyContactPhone: '+27880001122',
      emergencyContactRelation: 'Daughter',
      createdAt: daysAgo(50),
      updatedAt: now,
    },
  })
  console.log('Created clients')

  await prisma.assignment.upsert({
    where: {
      userId_clientId: {
        userId: usersByEmail['worker1@org1.com'].id,
        clientId: client1.id,
      },
    },
    update: {
      isActive: true,
      updatedAt: now,
    },
    create: {
      id: 'assignment_org1_worker1_client1',
      userId: usersByEmail['worker1@org1.com'].id,
      clientId: client1.id,
      isActive: true,
      createdAt: daysAgo(30),
      updatedAt: now,
    },
  })

  await prisma.assignment.upsert({
    where: {
      userId_clientId: {
        userId: usersByEmail['worker2@org1.com'].id,
        clientId: client2.id,
      },
    },
    update: {
      isActive: true,
      updatedAt: now,
    },
    create: {
      id: 'assignment_org1_worker2_client2',
      userId: usersByEmail['worker2@org1.com'].id,
      clientId: client2.id,
      isActive: true,
      createdAt: daysAgo(25),
      updatedAt: now,
    },
  })

  await prisma.assignment.upsert({
    where: {
      userId_clientId: {
        userId: usersByEmail['worker1@org2.com'].id,
        clientId: client3.id,
      },
    },
    update: {
      isActive: true,
      updatedAt: now,
    },
    create: {
      id: 'assignment_org2_worker1_client1',
      userId: usersByEmail['worker1@org2.com'].id,
      clientId: client3.id,
      isActive: true,
      createdAt: daysAgo(28),
      updatedAt: now,
    },
  })

  await prisma.assignment.upsert({
    where: {
      userId_clientId: {
        userId: usersByEmail['worker1@org2.com'].id,
        clientId: client4.id,
      },
    },
    update: {
      isActive: true,
      updatedAt: now,
    },
    create: {
      id: 'assignment_org2_worker1_client2',
      userId: usersByEmail['worker1@org2.com'].id,
      clientId: client4.id,
      isActive: true,
      createdAt: daysAgo(20),
      updatedAt: now,
    },
  })
  console.log('Created assignments')

  const task1 = await prisma.task.upsert({
    where: { id: 'org1_task_med_1' },
    update: {
      title: 'Morning medication',
      description: 'Administer blood pressure medication with breakfast',
      category: TaskCategory.MEDICATION,
      priority: TaskPriority.HIGH,
      clientId: client1.id,
      organizationId: org1.id,
      isRecurring: true,
      dueDate: daysFromNow(1),
      updatedAt: now,
    },
    create: {
      id: 'org1_task_med_1',
      title: 'Morning medication',
      description: 'Administer blood pressure medication with breakfast',
      category: TaskCategory.MEDICATION,
      priority: TaskPriority.HIGH,
      clientId: client1.id,
      organizationId: org1.id,
      isRecurring: true,
      dueDate: daysFromNow(1),
      createdAt: daysAgo(10),
      updatedAt: now,
    },
  })

  const task2 = await prisma.task.upsert({
    where: { id: 'org1_task_bath_1' },
    update: {
      title: 'Assist with bathing',
      description: 'Help with morning shower and personal care',
      category: TaskCategory.PERSONAL_CARE,
      priority: TaskPriority.NORMAL,
      clientId: client1.id,
      organizationId: org1.id,
      isRecurring: true,
      dueDate: daysFromNow(1),
      updatedAt: now,
    },
    create: {
      id: 'org1_task_bath_1',
      title: 'Assist with bathing',
      description: 'Help with morning shower and personal care',
      category: TaskCategory.PERSONAL_CARE,
      priority: TaskPriority.NORMAL,
      clientId: client1.id,
      organizationId: org1.id,
      isRecurring: true,
      dueDate: daysFromNow(1),
      createdAt: daysAgo(12),
      updatedAt: now,
    },
  })

  await prisma.task.upsert({
    where: { id: 'org1_task_housekeeping_1' },
    update: {
      title: 'Grocery pickup',
      description: 'Pick up groceries and restock pantry',
      category: TaskCategory.HOUSEKEEPING,
      priority: TaskPriority.LOW,
      clientId: client2.id,
      organizationId: org1.id,
      isRecurring: false,
      dueDate: daysFromNow(3),
      updatedAt: now,
    },
    create: {
      id: 'org1_task_housekeeping_1',
      title: 'Grocery pickup',
      description: 'Pick up groceries and restock pantry',
      category: TaskCategory.HOUSEKEEPING,
      priority: TaskPriority.LOW,
      clientId: client2.id,
      organizationId: org1.id,
      isRecurring: false,
      dueDate: daysFromNow(3),
      createdAt: daysAgo(8),
      updatedAt: now,
    },
  })

  await prisma.task.upsert({
    where: { id: 'org1_task_mobility_1' },
    update: {
      title: 'Evening walk',
      description: 'Assist with a 15-minute walk',
      category: TaskCategory.MOBILITY,
      priority: TaskPriority.NORMAL,
      clientId: client2.id,
      organizationId: org1.id,
      isRecurring: true,
      dueDate: daysFromNow(2),
      updatedAt: now,
    },
    create: {
      id: 'org1_task_mobility_1',
      title: 'Evening walk',
      description: 'Assist with a 15-minute walk',
      category: TaskCategory.MOBILITY,
      priority: TaskPriority.NORMAL,
      clientId: client2.id,
      organizationId: org1.id,
      isRecurring: true,
      dueDate: daysFromNow(2),
      createdAt: daysAgo(7),
      updatedAt: now,
    },
  })

  const task5 = await prisma.task.upsert({
    where: { id: 'org2_task_bp_1' },
    update: {
      title: 'Check blood pressure',
      description: 'Monitor and record vital signs',
      category: TaskCategory.HEALTH_MONITORING,
      priority: TaskPriority.HIGH,
      clientId: client3.id,
      organizationId: org2.id,
      isRecurring: true,
      dueDate: daysFromNow(1),
      updatedAt: now,
    },
    create: {
      id: 'org2_task_bp_1',
      title: 'Check blood pressure',
      description: 'Monitor and record vital signs',
      category: TaskCategory.HEALTH_MONITORING,
      priority: TaskPriority.HIGH,
      clientId: client3.id,
      organizationId: org2.id,
      isRecurring: true,
      dueDate: daysFromNow(1),
      createdAt: daysAgo(9),
      updatedAt: now,
    },
  })

  const task6 = await prisma.task.upsert({
    where: { id: 'org2_task_med_1' },
    update: {
      title: 'Medication review',
      description: 'Review evening medication and ensure adherence',
      category: TaskCategory.MEDICATION,
      priority: TaskPriority.URGENT,
      clientId: client3.id,
      organizationId: org2.id,
      isRecurring: true,
      dueDate: daysFromNow(0),
      updatedAt: now,
    },
    create: {
      id: 'org2_task_med_1',
      title: 'Medication review',
      description: 'Review evening medication and ensure adherence',
      category: TaskCategory.MEDICATION,
      priority: TaskPriority.URGENT,
      clientId: client3.id,
      organizationId: org2.id,
      isRecurring: true,
      dueDate: daysFromNow(0),
      createdAt: daysAgo(6),
      updatedAt: now,
    },
  })

  await prisma.task.upsert({
    where: { id: 'org2_task_meal_1' },
    update: {
      title: 'Prepare low-sodium lunch',
      description: 'Low sodium, balanced meal prep',
      category: TaskCategory.MEAL_PREP,
      priority: TaskPriority.NORMAL,
      clientId: client4.id,
      organizationId: org2.id,
      isRecurring: false,
      dueDate: daysFromNow(2),
      updatedAt: now,
    },
    create: {
      id: 'org2_task_meal_1',
      title: 'Prepare low-sodium lunch',
      description: 'Low sodium, balanced meal prep',
      category: TaskCategory.MEAL_PREP,
      priority: TaskPriority.NORMAL,
      clientId: client4.id,
      organizationId: org2.id,
      isRecurring: false,
      dueDate: daysFromNow(2),
      createdAt: daysAgo(5),
      updatedAt: now,
    },
  })

  await prisma.task.upsert({
    where: { id: 'org2_task_companion_1' },
    update: {
      title: 'Companionship call',
      description: '20-minute companionship check-in',
      category: TaskCategory.COMPANIONSHIP,
      priority: TaskPriority.LOW,
      clientId: client4.id,
      organizationId: org2.id,
      isRecurring: false,
      dueDate: daysFromNow(2),
      updatedAt: now,
    },
    create: {
      id: 'org2_task_companion_1',
      title: 'Companionship call',
      description: '20-minute companionship check-in',
      category: TaskCategory.COMPANIONSHIP,
      priority: TaskPriority.LOW,
      clientId: client4.id,
      organizationId: org2.id,
      isRecurring: false,
      dueDate: daysFromNow(2),
      createdAt: daysAgo(4),
      updatedAt: now,
    },
  })
  console.log('Created tasks')

  await prisma.taskCompletion.upsert({
    where: { id: 'completion_org1_task_med_1' },
    update: {
      taskId: task1.id,
      completedBy: usersByEmail['worker1@org1.com'].id,
      completedAt: hoursAgo(6),
      status: TaskCompletionStatus.COMPLETE,
      refusalReason: null,
      notes: 'Medication administered at 9:00 AM. Patient tolerated well.',
      signatureSvg: null,
      initials: 'JW',
      deviceInfo: 'Seeded iPhone 14',
      ipAddress: '10.10.1.10',
      criticalAlertFlagged: false,
    },
    create: {
      id: 'completion_org1_task_med_1',
      taskId: task1.id,
      completedBy: usersByEmail['worker1@org1.com'].id,
      completedAt: hoursAgo(6),
      status: TaskCompletionStatus.COMPLETE,
      refusalReason: null,
      notes: 'Medication administered at 9:00 AM. Patient tolerated well.',
      signatureSvg: null,
      initials: 'JW',
      deviceInfo: 'Seeded iPhone 14',
      ipAddress: '10.10.1.10',
      criticalAlertFlagged: false,
      createdAt: hoursAgo(6),
    },
  })

  await prisma.taskCompletion.upsert({
    where: { id: 'completion_org1_task_bath_1' },
    update: {
      taskId: task2.id,
      completedBy: usersByEmail['worker1@org1.com'].id,
      completedAt: hoursAgo(4),
      status: TaskCompletionStatus.INCOMPLETE,
      refusalReason: 'Client felt dizzy and requested to reschedule',
      notes: 'Checked vitals and suggested rest. Will retry later.',
      signatureSvg: null,
      initials: 'JW',
      deviceInfo: 'Seeded iPhone 14',
      ipAddress: '10.10.1.11',
      criticalAlertFlagged: false,
    },
    create: {
      id: 'completion_org1_task_bath_1',
      taskId: task2.id,
      completedBy: usersByEmail['worker1@org1.com'].id,
      completedAt: hoursAgo(4),
      status: TaskCompletionStatus.INCOMPLETE,
      refusalReason: 'Client felt dizzy and requested to reschedule',
      notes: 'Checked vitals and suggested rest. Will retry later.',
      signatureSvg: null,
      initials: 'JW',
      deviceInfo: 'Seeded iPhone 14',
      ipAddress: '10.10.1.11',
      criticalAlertFlagged: false,
      createdAt: hoursAgo(4),
    },
  })

  await prisma.taskCompletion.upsert({
    where: { id: 'completion_org2_task_med_1' },
    update: {
      taskId: task6.id,
      completedBy: usersByEmail['worker1@org2.com'].id,
      completedAt: hoursAgo(2),
      status: TaskCompletionStatus.REFUSED,
      refusalReason: 'Client declined due to nausea',
      notes: 'Encouraged hydration and notified nurse supervisor.',
      signatureSvg: null,
      initials: 'PC',
      deviceInfo: 'Seeded Android Tablet',
      ipAddress: '10.10.2.20',
      criticalAlertFlagged: true,
    },
    create: {
      id: 'completion_org2_task_med_1',
      taskId: task6.id,
      completedBy: usersByEmail['worker1@org2.com'].id,
      completedAt: hoursAgo(2),
      status: TaskCompletionStatus.REFUSED,
      refusalReason: 'Client declined due to nausea',
      notes: 'Encouraged hydration and notified nurse supervisor.',
      signatureSvg: null,
      initials: 'PC',
      deviceInfo: 'Seeded Android Tablet',
      ipAddress: '10.10.2.20',
      criticalAlertFlagged: true,
      createdAt: hoursAgo(2),
    },
  })

  await prisma.taskCompletion.upsert({
    where: { id: 'completion_org2_task_bp_1' },
    update: {
      taskId: task5.id,
      completedBy: usersByEmail['worker1@org2.com'].id,
      completedAt: hoursAgo(5),
      status: TaskCompletionStatus.COMPLETE,
      refusalReason: null,
      notes: 'BP reading 118/76. No concerns noted.',
      signatureSvg: null,
      initials: 'PC',
      deviceInfo: 'Seeded Android Tablet',
      ipAddress: '10.10.2.21',
      criticalAlertFlagged: false,
    },
    create: {
      id: 'completion_org2_task_bp_1',
      taskId: task5.id,
      completedBy: usersByEmail['worker1@org2.com'].id,
      completedAt: hoursAgo(5),
      status: TaskCompletionStatus.COMPLETE,
      refusalReason: null,
      notes: 'BP reading 118/76. No concerns noted.',
      signatureSvg: null,
      initials: 'PC',
      deviceInfo: 'Seeded Android Tablet',
      ipAddress: '10.10.2.21',
      criticalAlertFlagged: false,
      createdAt: hoursAgo(5),
    },
  })
  console.log('Created task completions')

  const note1Id = 'note_org1_client1_progress_v1'
  await prisma.note.upsert({
    where: { id: note1Id },
    update: {
      content:
        'Patient completed morning tasks. Blood pressure was 120/80 and appetite was good.',
      category: NoteCategory.PROGRESS,
      clientId: client1.id,
      authorId: usersByEmail['worker1@org1.com'].id,
      organizationId: org1.id,
      parentLogId: null,
      version: 1,
      isLatest: false,
      editReason: null,
      isSignificant: false,
      originalCreatedAt: daysAgo(2),
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
    create: {
      id: note1Id,
      content:
        'Patient completed morning tasks. Blood pressure was 120/80 and appetite was good.',
      category: NoteCategory.PROGRESS,
      clientId: client1.id,
      authorId: usersByEmail['worker1@org1.com'].id,
      organizationId: org1.id,
      parentLogId: null,
      version: 1,
      isLatest: false,
      editReason: null,
      isSignificant: false,
      originalCreatedAt: daysAgo(2),
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
  })

  await prisma.note.upsert({
    where: { id: 'note_org1_client1_progress_v2' },
    update: {
      content:
        'Patient completed morning tasks. Blood pressure was 120/80. Added note: mood was upbeat.',
      category: NoteCategory.PROGRESS,
      clientId: client1.id,
      authorId: usersByEmail['worker1@org1.com'].id,
      organizationId: org1.id,
      parentLogId: note1Id,
      version: 2,
      isLatest: true,
      editReason: 'Added mood observation',
      isSignificant: true,
      originalCreatedAt: daysAgo(2),
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    create: {
      id: 'note_org1_client1_progress_v2',
      content:
        'Patient completed morning tasks. Blood pressure was 120/80. Added note: mood was upbeat.',
      category: NoteCategory.PROGRESS,
      clientId: client1.id,
      authorId: usersByEmail['worker1@org1.com'].id,
      organizationId: org1.id,
      parentLogId: note1Id,
      version: 2,
      isLatest: true,
      editReason: 'Added mood observation',
      isSignificant: true,
      originalCreatedAt: daysAgo(2),
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
  })

  await prisma.note.upsert({
    where: { id: 'note_org1_client2_incident_1' },
    update: {
      content:
        'Client reported shortness of breath after stair use. Rested and recovered within 10 minutes.',
      category: NoteCategory.INCIDENT,
      clientId: client2.id,
      authorId: usersByEmail['worker2@org1.com'].id,
      organizationId: org1.id,
      parentLogId: null,
      version: 1,
      isLatest: true,
      editReason: null,
      isSignificant: true,
      originalCreatedAt: hoursAgo(6),
      createdAt: hoursAgo(6),
      updatedAt: hoursAgo(6),
    },
    create: {
      id: 'note_org1_client2_incident_1',
      content:
        'Client reported shortness of breath after stair use. Rested and recovered within 10 minutes.',
      category: NoteCategory.INCIDENT,
      clientId: client2.id,
      authorId: usersByEmail['worker2@org1.com'].id,
      organizationId: org1.id,
      parentLogId: null,
      version: 1,
      isLatest: true,
      editReason: null,
      isSignificant: true,
      originalCreatedAt: hoursAgo(6),
      createdAt: hoursAgo(6),
      updatedAt: hoursAgo(6),
    },
  })

  await prisma.note.upsert({
    where: { id: 'note_org1_client1_comm_1' },
    update: {
      content:
        'Spoke with daughter Sarah regarding cardiology appointment on Friday. Transport confirmed.',
      category: NoteCategory.COMMUNICATION,
      clientId: client1.id,
      authorId: usersByEmail['worker1@org1.com'].id,
      organizationId: org1.id,
      parentLogId: null,
      version: 1,
      isLatest: true,
      editReason: null,
      isSignificant: false,
      originalCreatedAt: daysAgo(1),
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    create: {
      id: 'note_org1_client1_comm_1',
      content:
        'Spoke with daughter Sarah regarding cardiology appointment on Friday. Transport confirmed.',
      category: NoteCategory.COMMUNICATION,
      clientId: client1.id,
      authorId: usersByEmail['worker1@org1.com'].id,
      organizationId: org1.id,
      parentLogId: null,
      version: 1,
      isLatest: true,
      editReason: null,
      isSignificant: false,
      originalCreatedAt: daysAgo(1),
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
  })

  await prisma.note.upsert({
    where: { id: 'note_org2_client1_progress_1' },
    update: {
      content: 'Blood pressure check completed. Reading: 118/76. Patient feeling well.',
      category: NoteCategory.PROGRESS,
      clientId: client3.id,
      authorId: usersByEmail['worker1@org2.com'].id,
      organizationId: org2.id,
      parentLogId: null,
      version: 1,
      isLatest: true,
      editReason: null,
      isSignificant: false,
      originalCreatedAt: hoursAgo(5),
      createdAt: hoursAgo(5),
      updatedAt: hoursAgo(5),
    },
    create: {
      id: 'note_org2_client1_progress_1',
      content: 'Blood pressure check completed. Reading: 118/76. Patient feeling well.',
      category: NoteCategory.PROGRESS,
      clientId: client3.id,
      authorId: usersByEmail['worker1@org2.com'].id,
      organizationId: org2.id,
      parentLogId: null,
      version: 1,
      isLatest: true,
      editReason: null,
      isSignificant: false,
      originalCreatedAt: hoursAgo(5),
      createdAt: hoursAgo(5),
      updatedAt: hoursAgo(5),
    },
  })

  await prisma.note.upsert({
    where: { id: 'note_org2_client2_general_1' },
    update: {
      content:
        'Client enjoyed a 20-minute walk in the garden. Mild knee discomfort noted but no swelling.',
      category: NoteCategory.GENERAL,
      clientId: client4.id,
      authorId: usersByEmail['worker1@org2.com'].id,
      organizationId: org2.id,
      parentLogId: null,
      version: 1,
      isLatest: true,
      editReason: null,
      isSignificant: true,
      originalCreatedAt: hoursAgo(3),
      createdAt: hoursAgo(3),
      updatedAt: hoursAgo(3),
    },
    create: {
      id: 'note_org2_client2_general_1',
      content:
        'Client enjoyed a 20-minute walk in the garden. Mild knee discomfort noted but no swelling.',
      category: NoteCategory.GENERAL,
      clientId: client4.id,
      authorId: usersByEmail['worker1@org2.com'].id,
      organizationId: org2.id,
      parentLogId: null,
      version: 1,
      isLatest: true,
      editReason: null,
      isSignificant: true,
      originalCreatedAt: hoursAgo(3),
      createdAt: hoursAgo(3),
      updatedAt: hoursAgo(3),
    },
  })
  console.log('Created notes')

  console.log('Seeding complete')
  console.log('Test credentials:')
  console.log('Super Admin: superadmin@bloom.com / SuperPass123')
  console.log('Org1 Owner:  owner1@org1.com / Password123')
  console.log('Org1 Admin:  admin1@org1.com / Password123')
  console.log('Org1 Manager: manager1@org1.com / Password123')
  console.log('Org1 Worker: worker1@org1.com / Password123')
  console.log('Org2 Owner:  owner2@org2.com / Password123')
  console.log('Org2 Admin:  admin2@org2.com / Password123')
  console.log('Org2 Manager: manager2@org2.com / Password123')
  console.log('Org2 Worker: worker1@org2.com / Password123')
  console.log(`Org IDs: ${org1.id}, ${org2.id}`)
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
