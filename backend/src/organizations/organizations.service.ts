import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { UserOrganization } from './entities/user-organization.entity';
import { OrganizationRole } from './entities/organization-role.enum';
import { User } from '../users/entities/user.entity';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(UserOrganization)
    private userOrganizationRepository: Repository<UserOrganization>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(name: string, userId: string, companyName?: string): Promise<Organization> {
    // Create organization
    const organization = this.organizationRepository.create({
      name,
      companyName: companyName || name,
    });
    const savedOrg = await this.organizationRepository.save(organization);

    // Add creator as owner
    await this.addUserToOrganization(savedOrg.id, userId, OrganizationRole.OWNER);

    this.logger.log(`Organization created: ${savedOrg.id} by user ${userId}`);
    return savedOrg;
  }

  async findAll(userId: string): Promise<Organization[]> {
    const userOrgs = await this.userOrganizationRepository.find({
      where: { userId, isActive: true },
      relations: ['organization'],
    });
    return userOrgs.map(uo => uo.organization);
  }

  async findOne(id: string, userId: string): Promise<Organization> {
    // Verify user has access to this organization
    const userOrg = await this.userOrganizationRepository.findOne({
      where: { organizationId: id, userId, isActive: true },
      relations: ['organization'],
    });

    if (!userOrg) {
      throw new NotFoundException('Organization not found or access denied');
    }

    return userOrg.organization;
  }

  async update(id: string, userId: string, data: Partial<Organization>): Promise<Organization> {
    // Verify user has admin/owner role
    const userOrg = await this.userOrganizationRepository.findOne({
      where: { organizationId: id, userId, isActive: true },
    });

    if (!userOrg) {
      throw new NotFoundException('Organization not found or access denied');
    }

    if (userOrg.role !== OrganizationRole.OWNER && userOrg.role !== OrganizationRole.ADMIN) {
      throw new BadRequestException('Only owners and admins can update organization');
    }

    await this.organizationRepository.update(id, data);
    return this.findOne(id, userId);
  }

  async addUserToOrganization(
    organizationId: string,
    userId: string,
    role: OrganizationRole = OrganizationRole.STAFF,
    addedByUserId?: string,
  ): Promise<UserOrganization> {
    // Check if user is already in organization
    const existing = await this.userOrganizationRepository.findOne({
      where: { organizationId, userId },
    });

    if (existing) {
      if (existing.isActive) {
        throw new BadRequestException('User is already a member of this organization');
      }
      // Reactivate if previously removed
      existing.isActive = true;
      existing.role = role;
      existing.joinedAt = new Date();
      return this.userOrganizationRepository.save(existing);
    }

    // Verify the person adding has permission (if provided)
    if (addedByUserId) {
      const adderOrg = await this.userOrganizationRepository.findOne({
        where: { organizationId, userId: addedByUserId, isActive: true },
      });

      if (!adderOrg || (adderOrg.role !== OrganizationRole.OWNER && adderOrg.role !== OrganizationRole.ADMIN)) {
        throw new BadRequestException('Only owners and admins can add users to organization');
      }
    }

    const userOrg = this.userOrganizationRepository.create({
      organizationId,
      userId,
      role,
      isActive: true,
      joinedAt: new Date(),
    });

    return this.userOrganizationRepository.save(userOrg);
  }

  async removeUserFromOrganization(organizationId: string, userId: string, removedByUserId: string): Promise<void> {
    // Verify remover has permission
    const removerOrg = await this.userOrganizationRepository.findOne({
      where: { organizationId, userId: removedByUserId, isActive: true },
    });

    if (!removerOrg || (removerOrg.role !== OrganizationRole.OWNER && removerOrg.role !== OrganizationRole.ADMIN)) {
      throw new BadRequestException('Only owners and admins can remove users from organization');
    }

    // Prevent removing yourself if you're the only owner
    if (userId === removedByUserId) {
      const ownerCount = await this.userOrganizationRepository.count({
        where: { organizationId, role: OrganizationRole.OWNER, isActive: true },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the last owner from organization');
      }
    }

    const userOrg = await this.userOrganizationRepository.findOne({
      where: { organizationId, userId },
    });

    if (!userOrg) {
      throw new NotFoundException('User is not a member of this organization');
    }

    userOrg.isActive = false;
    await this.userOrganizationRepository.save(userOrg);
  }

  async updateUserRole(
    organizationId: string,
    userId: string,
    role: OrganizationRole,
    updatedByUserId: string,
  ): Promise<UserOrganization> {
    // Verify updater has permission
    const updaterOrg = await this.userOrganizationRepository.findOne({
      where: { organizationId, userId: updatedByUserId, isActive: true },
    });

    if (!updaterOrg || (updaterOrg.role !== OrganizationRole.OWNER && updaterOrg.role !== OrganizationRole.ADMIN)) {
      throw new BadRequestException('Only owners and admins can update user roles');
    }

    // Prevent changing role of last owner
    if (role !== OrganizationRole.OWNER) {
      const ownerCount = await this.userOrganizationRepository.count({
        where: { organizationId, role: OrganizationRole.OWNER, isActive: true },
      });
      const userOrg = await this.userOrganizationRepository.findOne({
        where: { organizationId, userId },
      });
      if (userOrg?.role === OrganizationRole.OWNER && ownerCount <= 1) {
        throw new BadRequestException('Cannot change role of the last owner');
      }
    }

    const userOrg = await this.userOrganizationRepository.findOne({
      where: { organizationId, userId },
    });

    if (!userOrg || !userOrg.isActive) {
      throw new NotFoundException('User is not an active member of this organization');
    }

    userOrg.role = role;
    return this.userOrganizationRepository.save(userOrg);
  }

  async getOrganizationUsers(organizationId: string, userId: string): Promise<UserOrganization[]> {
    // Verify user has access
    const userOrg = await this.userOrganizationRepository.findOne({
      where: { organizationId, userId, isActive: true },
    });

    if (!userOrg) {
      throw new NotFoundException('Organization not found or access denied');
    }

    return this.userOrganizationRepository.find({
      where: { organizationId, isActive: true },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async getUserRole(organizationId: string, userId: string): Promise<OrganizationRole | null> {
    const userOrg = await this.userOrganizationRepository.findOne({
      where: { organizationId, userId, isActive: true },
    });

    return userOrg?.role || null;
  }

  async getUserOrganizations(userId: string): Promise<UserOrganization[]> {
    return this.userOrganizationRepository.find({
      where: { userId, isActive: true },
      relations: ['organization'],
      order: { createdAt: 'ASC' },
    });
  }

  async ensureUserHasOrganization(userId: string): Promise<void> {
    const userOrgs = await this.getUserOrganizations(userId);
    
    // If user has no organizations, create one automatically
    if (!userOrgs || userOrgs.length === 0) {
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });
      
      if (user) {
        const orgName = user.companyName || user.name || user.email.split('@')[0];
        await this.create(orgName, userId, user.companyName);
        this.logger.log(`Auto-created organization for user ${userId}`);
      }
    }
  }

  async delete(organizationId: string, userId: string): Promise<void> {
    // Only owners can delete
    const userOrg = await this.userOrganizationRepository.findOne({
      where: { organizationId, userId, isActive: true },
    });

    if (!userOrg || userOrg.role !== OrganizationRole.OWNER) {
      throw new BadRequestException('Only organization owners can delete the organization');
    }

    await this.organizationRepository.delete(organizationId);
  }
}

