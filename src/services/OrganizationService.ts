import { mailService } from './MailService';

interface OrganizationEmailInput {
  id: string;
  name: string;
  slug: string;
}

interface ManagerContactInput {
  manager_name?: string | null;
  manager_email?: string | null;
}

export class OrganizationService {
  triggerWelcomeEmail(
    organization: OrganizationEmailInput,
    manager: ManagerContactInput
  ) {
    const managerEmail = manager.manager_email?.trim();

    if (!managerEmail) {
      return;
    }

    const managerName = manager.manager_name?.trim() || 'Manager';

    mailService
      .sendWelcomeEmail({
        organizationId: organization.id,
        manager_name: managerName,
        company_name: organization.name,
        slug: organization.slug,
        manager_email: managerEmail,
      })
      .catch((error) =>
        console.error('[OrganizationService] welcome email trigger', error)
      );
  }
}

export const organizationService = new OrganizationService();
