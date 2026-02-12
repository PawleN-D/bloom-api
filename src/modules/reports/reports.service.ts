import { FastifyRequest } from 'fastify';
import { PassThrough } from 'stream';
import PDFDocument from 'pdfkit';
import {
  AuditAccessStatus,
  NoteCategory,
  TaskCategory,
  TaskCompletionStatus,
  UserRole,
} from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { withTenantIsolation } from '../../shared/middleware/tenant-context';

type StaffInfo = {
  id: string;
  name: string;
  role: UserRole;
};

type TaskLogEntry = {
  id: string;
  taskId: string;
  taskTitle: string;
  taskCategory: TaskCategory;
  status: TaskCompletionStatus;
  notes: string | null;
  refusalReason: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date;
  staff: StaffInfo;
};

type NoteEntry = {
  id: string;
  content: string;
  category: NoteCategory;
  version: number;
  parentLogId: string | null;
  editReason: string | null;
  isLatest: boolean;
  originalCreatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  staff: StaffInfo;
};

type NoteAuditTrailGroup = {
  rootId: string;
  versions: NoteEntry[];
};

type AuditReportData = {
  resident: {
    id: string;
    name: string;
    dateOfBirth: Date | null;
  };
  dateRange: {
    start: Date;
    end: Date;
  };
  summary: {
    totalLogs: number;
    completedLogs: number;
    completionRate: number;
    exceptionCount: number;
  };
  taskLogs: TaskLogEntry[];
  exceptions: TaskLogEntry[];
  noteAuditTrail: NoteAuditTrailGroup[];
  compliance: {
    safe: {
      medicationLogs: TaskLogEntry[];
      incidentReports: NoteEntry[];
    };
    effective: {
      carePlanProgress: NoteEntry[];
      nutritionHydration: {
        mealPrepTasks: number;
        hydrationMentions: number;
      };
    };
    wellLed: {
      managementAcknowledgements: TaskLogEntry[];
    };
  };
  clinicalSafety: {
    medication: TaskLogEntry[];
    hydration: NoteEntry[];
    incidents: NoteEntry[];
  };
  chronologicalLog: Array<{
    type: 'TASK' | 'NOTE';
    timestamp: Date;
    description: string;
    staff: StaffInfo;
    createdAt: Date;
    updatedAt: Date;
  }>;
};


type OrganizationReportStats = {
  tasksCompleted: number;
  complianceRate: number;
  incidents: number;
  handoverNotes: number;
};

type OrganizationReportSnapshot = {
  reportType: string;
  dateRange: {
    start: Date;
    end: Date;
    label: string;
  };
  stats: OrganizationReportStats;
  sections: string[];
  generatedAt: Date;
};

const startOfDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);

const endOfDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);

const formatReportLabel = (value: string) =>
  (value || '')
    .replace(/[-_]/g, ' ')
    .replace(/(^|\s)\S/g, (char) => char.toUpperCase());

const formatDateLabel = (value: Date) =>
  value.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const getRangeLabel = (range: string, start: Date, end: Date) => {
  switch (range) {
    case 'today':
      return 'Today';
    case 'yesterday':
      return 'Yesterday';
    case 'last-7-days':
      return 'Last 7 days';
    case 'last-30-days':
      return 'Last 30 days';
    case 'this-month':
      return 'This month';
    case 'last-month':
      return 'Last month';
    case 'custom':
      return `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
    default:
      return `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
  }
};

export class ReportsService {
  async recordAuditAccess(
    request: FastifyRequest,
    residentId: string,
    managerId: string,
    status: AuditAccessStatus
  ) {
    if (!request.organization) {
      return;
    }

    await prisma.auditAccessLog.create({
      data: {
        organizationId: request.organization.id,
        residentId,
        managerId,
        status,
        createdAt: new Date(),
      },
    });
  }

  async getManagerDisplayName(request: FastifyRequest, managerId: string) {
    const manager = await prisma.user.findUnique({
      where: withTenantIsolation(request, { id: managerId }),
      select: {
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!manager) {
      return 'Unknown Manager';
    }

    return `${manager.firstName} ${manager.lastName} (${manager.role})`;
  }

  resolveDateRange(dateRange: string, customStart?: string, customEnd?: string) {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (dateRange) {
      case 'today':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'yesterday': {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        start = startOfDay(yesterday);
        end = endOfDay(yesterday);
        break;
      }
      case 'last-7-days': {
        const startDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        start = startOfDay(startDate);
        end = endOfDay(now);
        break;
      }
      case 'last-30-days': {
        const startDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
        start = startOfDay(startDate);
        end = endOfDay(now);
        break;
      }
      case 'this-month':
        start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
        end = endOfDay(now);
        break;
      case 'last-month': {
        const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        start = startOfDay(startDate);
        end = endOfDay(endDate);
        break;
      }
      case 'custom': {
        if (!customStart || !customEnd) {
          throw new Error('Custom start and end dates are required');
        }
        const startDate = new Date(customStart);
        const endDate = new Date(customEnd);
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
          throw new Error('Invalid date range');
        }
        start = startOfDay(startDate);
        end = endOfDay(endDate);
        break;
      }
      default:
        throw new Error('Invalid date range');
    }

    if (start > end) {
      throw new Error('Invalid date range');
    }

    return {
      start,
      end,
      label: getRangeLabel(dateRange, start, end),
    };
  }

  async getOrganizationQuickStats(request: FastifyRequest, start: Date, end: Date) {
    if (!request.organization) {
      throw new Error('Organization context required');
    }

    const tasksCompleted = await prisma.taskCompletion.count({
      where: {
        task: {
          organizationId: request.organization.id,
        },
        status: TaskCompletionStatus.COMPLETE,
        completedAt: {
          gte: start,
          lte: end,
        },
      },
    });

    const totalTasks = await prisma.task.count({
      where: {
        organizationId: request.organization.id,
        dueDate: {
          gte: start,
          lte: end,
        },
      },
    });

    const complianceRate = totalTasks
      ? Math.round((tasksCompleted / totalTasks) * 100)
      : 0;

    const incidents = await prisma.note.count({
      where: withTenantIsolation(request, {
        category: NoteCategory.INCIDENT,
        isLatest: true,
        createdAt: {
          gte: start,
          lte: end,
        },
      }),
    });

    const handoverNotes = await prisma.note.count({
      where: withTenantIsolation(request, {
        isSignificant: true,
        isLatest: true,
        createdAt: {
          gte: start,
          lte: end,
        },
      }),
    });

    return {
      tasksCompleted,
      complianceRate,
      incidents,
      handoverNotes,
    };
  }

  generateOrganizationReportPdf(
    snapshot: OrganizationReportSnapshot,
    managerName: string
  ): PassThrough {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = new PassThrough();
    doc.pipe(stream);

    const brand = {
      primary: '#0F766E',
      text: '#0F172A',
      muted: '#475569',
      light: '#E2E8F0',
    };

    const formatGenerated = (value: Date) =>
      value.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

    doc.fillColor(brand.primary).fontSize(20).font('Helvetica-Bold');
    doc.text('Bloom Care Platform', { align: 'center' });
    doc.moveDown(0.5);
    doc.fillColor(brand.muted).fontSize(11).font('Helvetica');
    doc.text(`Report Type: ${formatReportLabel(snapshot.reportType)}`, { align: 'center' });
    doc.text(`Period: ${snapshot.dateRange.label}`, { align: 'center' });

    doc.moveDown(1.5);
    doc.fillColor(brand.text).fontSize(14).font('Helvetica-Bold');
    doc.text('Executive Summary');

    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(11);
    doc.text(`Tasks completed: ${snapshot.stats.tasksCompleted}`);
    doc.text(`Compliance rate: ${snapshot.stats.complianceRate}%`);
    doc.text(`Reported incidents: ${snapshot.stats.incidents}`);
    doc.text(`Handover notes: ${snapshot.stats.handoverNotes}`);

    if (snapshot.sections.length) {
      doc.moveDown(1.0);
      doc.font('Helvetica-Bold').fontSize(12).text('Included Sections');
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(10);
      snapshot.sections.forEach((section) => {
        doc.text(`- ${formatReportLabel(section)}`);
      });
    }

    doc.moveDown(1.5);
    doc.strokeColor(brand.light).moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fillColor(brand.muted).fontSize(9);
    doc.text(`Generated: ${formatGenerated(snapshot.generatedAt)}`);
    doc.text(`Manager: ${managerName}`);

    doc.end();
    return stream;
  }


  async getAuditReportData(
    request: FastifyRequest,
    residentId: string,
    startDate: string,
    endDate: string
  ): Promise<AuditReportData> {
    if (!request.organization) {
      throw new Error('Organization context required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('Invalid date range');
    }

    if (start > end) {
      throw new Error('Invalid date range');
    }

    const resident = await prisma.client.findUnique({
      where: withTenantIsolation(request, { id: residentId }),
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
      },
    });

    if (!resident) {
      throw new Error('Resident not found');
    }

    const taskLogsRaw = await prisma.taskCompletion.findMany({
      where: {
        task: {
          clientId: residentId,
          organizationId: request.organization.id,
        },
        completedAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            category: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: {
        completedAt: 'asc',
      },
    });

    const taskLogs: TaskLogEntry[] = taskLogsRaw.map((log) => ({
      id: log.id,
      taskId: log.taskId,
      taskTitle: log.task.title,
      taskCategory: log.task.category,
      status: log.status,
      notes: log.notes || null,
      refusalReason: log.refusalReason || null,
      metadata: (log.metadata as Record<string, any>) || null,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
      completedAt: log.completedAt,
      staff: {
        id: log.user.id,
        name: `${log.user.firstName} ${log.user.lastName}`,
        role: log.user.role,
      },
    }));

    const notesInRangeRaw = await prisma.note.findMany({
      where: withTenantIsolation(request, {
        clientId: residentId,
        createdAt: {
          gte: start,
          lte: end,
        },
      }),
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const notesInRange: NoteEntry[] = notesInRangeRaw.map((note) => ({
      id: note.id,
      content: note.content,
      category: note.category,
      version: note.version,
      parentLogId: note.parentLogId,
      editReason: note.editReason,
      isLatest: note.isLatest,
      originalCreatedAt: note.originalCreatedAt,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      staff: {
        id: note.user.id,
        name: `${note.user.firstName} ${note.user.lastName}`,
        role: note.user.role,
      },
    }));

    const editedNoteRoots = await prisma.note.findMany({
      where: withTenantIsolation(request, {
        clientId: residentId,
        OR: [
          { parentLogId: { not: null } },
          { versions: { some: {} } },
        ],
      }),
      select: {
        id: true,
        parentLogId: true,
      },
    });

    const rootIds = Array.from(
      new Set(
        editedNoteRoots.map((note) => note.parentLogId || note.id)
      )
    );

    const noteVersionsRaw = rootIds.length
      ? await prisma.note.findMany({
          where: withTenantIsolation(request, {
            clientId: residentId,
            OR: [
              { id: { in: rootIds } },
              { parentLogId: { in: rootIds } },
            ],
          }),
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
          orderBy: [
            { originalCreatedAt: 'asc' },
            { version: 'asc' },
          ],
        })
      : [];

    const noteVersions: NoteEntry[] = noteVersionsRaw.map((note) => ({
      id: note.id,
      content: note.content,
      category: note.category,
      version: note.version,
      parentLogId: note.parentLogId,
      editReason: note.editReason,
      isLatest: note.isLatest,
      originalCreatedAt: note.originalCreatedAt,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      staff: {
        id: note.user.id,
        name: `${note.user.firstName} ${note.user.lastName}`,
        role: note.user.role,
      },
    }));

    const noteAuditTrail = rootIds.map((rootId) => ({
      rootId,
      versions: noteVersions
        .filter((note) => note.id === rootId || note.parentLogId === rootId)
        .sort((a, b) => a.version - b.version),
    }));

    const exceptionStatuses = new Set<TaskCompletionStatus>([
      TaskCompletionStatus.INCOMPLETE,
      TaskCompletionStatus.REFUSED,
    ]);
    const exceptions = taskLogs.filter((log) => exceptionStatuses.has(log.status));

    const medicationLogs = taskLogs.filter(
      (log) => log.taskCategory === TaskCategory.MEDICATION
    );

    const incidentReports = notesInRange.filter(
      (note) => note.category === NoteCategory.INCIDENT
    );

    const progressNotes = notesInRange.filter(
      (note) => note.category === NoteCategory.PROGRESS
    );

    const hydrationMentions = notesInRange.filter((note) =>
      /hydration|fluids|water/i.test(note.content)
    ).length;

    const mealPrepTasks = taskLogs.filter(
      (log) => log.taskCategory === TaskCategory.MEAL_PREP
    ).length;

    const hydrationNotes = notesInRange.filter((note) =>
      /hydration|fluids|water/i.test(note.content)
    );

    const managementRoles = new Set<UserRole>([
      UserRole.MANAGER,
      UserRole.ADMIN,
      UserRole.ORG_OWNER,
    ]);
    const managementAcknowledgements = exceptions.filter((log) => {
      if (log.metadata?.managementAcknowledged === true) {
        return true;
      }
      return managementRoles.has(log.staff.role);
    });

    const chronologicalLog = [
      ...taskLogs.map((log) => ({
        type: 'TASK' as const,
        timestamp: log.completedAt,
        description: `${log.taskTitle} (${log.status})`,
        staff: log.staff,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
      })),
      ...notesInRange.map((note) => ({
        type: 'NOTE' as const,
        timestamp: note.createdAt,
        description: `${note.category}: ${note.content.slice(0, 80)}`,
        staff: note.staff,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      })),
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const totalLogs = taskLogs.length;
    const completedLogs = taskLogs.filter(
      (log) => log.status === TaskCompletionStatus.COMPLETE
    ).length;
    const completionRate =
      totalLogs === 0 ? 0 : Math.round((completedLogs / totalLogs) * 100);

    return {
      resident: {
        id: resident.id,
        name: `${resident.firstName} ${resident.lastName}`,
        dateOfBirth: resident.dateOfBirth,
      },
      dateRange: { start, end },
      summary: {
        totalLogs,
        completedLogs,
        completionRate,
        exceptionCount: exceptions.length,
      },
      taskLogs,
      exceptions,
      noteAuditTrail,
      compliance: {
        safe: {
          medicationLogs,
          incidentReports,
        },
        effective: {
          carePlanProgress: progressNotes,
          nutritionHydration: {
            mealPrepTasks,
            hydrationMentions,
          },
        },
        wellLed: {
          managementAcknowledgements,
        },
      },
      clinicalSafety: {
        medication: medicationLogs,
        hydration: hydrationNotes,
        incidents: incidentReports,
      },
      chronologicalLog,
    };
  }

  generateAuditReportPdf(report: AuditReportData, managerName: string): PassThrough {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = new PassThrough();
    doc.pipe(stream);

    const brand = {
      primary: '#0F766E',
      text: '#0F172A',
      muted: '#475569',
      light: '#E2E8F0',
    };

    const formatDate = (value: Date) =>
      `${value.toLocaleDateString('en-US')} ${value.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;

    let pageNumber = 1;
    const contentStartY = 80;

    const drawHeader = () => {
      doc.rect(0, 0, doc.page.width, 60).fill(brand.primary);
      doc
        .fillColor('white')
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('Bloom', 50, 20, { align: 'left' });
      doc
        .fontSize(12)
        .font('Helvetica')
        .text('Compliance Audit Report', 50, 40, { align: 'left' });
      doc.fillColor(brand.text);
      doc.y = contentStartY;
    };

    const drawFooter = () => {
      const y = doc.page.height - 40;
      const prevX = doc.x;
      const prevY = doc.y;
      doc
        .strokeColor(brand.light)
        .moveTo(50, y)
        .lineTo(doc.page.width - 50, y)
        .stroke();
      doc
        .fillColor(brand.muted)
        .fontSize(9)
        .text(`Generated ${formatDate(new Date())}`, 50, y + 10, { align: 'left' });
      doc
        .fontSize(9)
        .text(`Manager: ${managerName}`, 50, y + 22, { align: 'left' });
      doc
        .fontSize(9)
        .text(`Page ${pageNumber}`, doc.page.width - 100, y + 10, { align: 'right' });
      doc.fillColor(brand.text);
      doc.x = prevX;
      doc.y = prevY;
    };

    drawHeader();
    drawFooter();

    doc.on('pageAdded', () => {
      pageNumber += 1;
      drawHeader();
      drawFooter();
    });

    doc
      .fillColor(brand.text)
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(report.resident.name);
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor(brand.muted)
      .text(`Resident ID: ${report.resident.id}`);
    doc
      .text(
        `Date Range: ${formatDate(report.dateRange.start)} - ${formatDate(report.dateRange.end)}`
      );
    doc.moveDown();

    doc.fillColor(brand.text).fontSize(13).font('Helvetica-Bold').text('Summary');
    doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4).stroke(brand.light);
    doc.moveDown(0.8);

    const summaryRows = [
      ['Total Task Logs', report.summary.totalLogs.toString()],
      ['Completed Logs', report.summary.completedLogs.toString()],
      ['Completion Rate', `${report.summary.completionRate}%`],
      ['Exceptions', report.summary.exceptionCount.toString()],
    ];

    const tableX = 60;
    const tableY = doc.y;
    const rowHeight = 20;
    const colWidth = 240;

    doc
      .fillColor(brand.muted)
      .fontSize(9)
      .text('Metric', tableX, tableY, { width: colWidth });
    doc.text('Value', tableX + colWidth, tableY, { width: colWidth });

    summaryRows.forEach((row, index) => {
      const y = tableY + 12 + index * rowHeight;
      doc
        .fillColor(brand.text)
        .fontSize(10)
        .text(row[0], tableX, y, { width: colWidth });
      doc.text(row[1], tableX + colWidth, y, { width: colWidth });
      doc
        .strokeColor(brand.light)
        .moveTo(tableX, y + 16)
        .lineTo(tableX + colWidth * 2, y + 16)
        .stroke();
    });

    doc.moveDown(3);
    doc.fillColor(brand.text).fontSize(13).font('Helvetica-Bold').text('Compliance Mapping');
    doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4).stroke(brand.light);
    doc.moveDown(0.8);

    doc.fontSize(11).font('Helvetica-Bold').text('Safe');
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Medication Logs: ${report.compliance.safe.medicationLogs.length}`);
    doc.text(`Incident Reports: ${report.compliance.safe.incidentReports.length}`);

    doc.moveDown(0.6);
    doc.fontSize(11).font('Helvetica-Bold').text('Effective');
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Care Plan Progress Notes: ${report.compliance.effective.carePlanProgress.length}`);
    doc.text(
      `Meal Prep Tasks: ${report.compliance.effective.nutritionHydration.mealPrepTasks}`
    );
    doc.text(
      `Hydration Mentions: ${report.compliance.effective.nutritionHydration.hydrationMentions}`
    );

    doc.moveDown(0.6);
    doc.fontSize(11).font('Helvetica-Bold').text('Well-Led');
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(
        `Management Acknowledgements: ${report.compliance.wellLed.managementAcknowledgements.length}`
      );

    doc.moveDown(1.2);
    doc.fillColor(brand.text).fontSize(13).font('Helvetica-Bold').text('Contemporaneous Evidence');
    doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4).stroke(brand.light);
    doc.moveDown(0.6);

    report.chronologicalLog.forEach((entry) => {
      if (doc.y > 700) {
        doc.addPage();
      }
      const timestamp = formatDate(entry.timestamp);
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(brand.text)
        .text(
          `${timestamp}  |  ${entry.type}  |  ${entry.description}  |  ${entry.staff.name} (${entry.staff.role})`
        );
    });

    doc.end();
    return stream;
  }
}
