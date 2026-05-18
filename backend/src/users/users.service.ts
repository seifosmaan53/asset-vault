import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async createFromClerk(data: { clerkUserId: string; email: string; name: string; companyName?: string }): Promise<User> {
    // Normalize email to lowercase
    const normalizedEmail = data.email.toLowerCase().trim();
    
    // Check if user with this email already exists
    const existingUser = await this.findByEmail(normalizedEmail);
    if (existingUser) {
      // If user exists but doesn't have a clerkUserId, link it
      if (!existingUser.clerkUserId) {
        existingUser.clerkUserId = data.clerkUserId;
        return this.usersRepository.save(existingUser);
      }
      // If user exists with different clerkUserId, throw error
      throw new Error(`User with email ${normalizedEmail} already exists with different Clerk ID`);
    }
    
    const user = this.usersRepository.create({
      clerkUserId: data.clerkUserId,
      email: normalizedEmail,
      name: data.name.trim(),
      companyName: data.companyName?.trim(),
      emailVerified: true, // Clerk handles email verification
      role: UserRole.OWNER, // All new users get owner privileges
    });
    
    try {
      return await this.usersRepository.save(user);
    } catch (error: any) {
      // Handle duplicate email constraint violation
      if (error.code === '23505' && error.constraint === 'UQ_users_email') {
        // Email already exists, try to find and link
        const existingUser = await this.findByEmail(normalizedEmail);
        if (existingUser && !existingUser.clerkUserId) {
          existingUser.clerkUserId = data.clerkUserId;
          return this.usersRepository.save(existingUser);
        }
        throw new Error(`User with email ${normalizedEmail} already exists`);
      }
      throw error;
    }
  }

  async linkToClerk(userId: string, clerkUserId: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error(`User with id ${userId} not found`);
    }
    user.clerkUserId = clerkUserId;
    return this.usersRepository.save(user);
  }

  async findByClerkId(clerkUserId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { clerkUserId } });
  }

  async findByEmail(email: string): Promise<User | null> {
    // Normalize email to lowercase for consistent lookups
    const normalizedEmail = email.toLowerCase().trim();
    return this.usersRepository.findOne({ where: { email: normalizedEmail } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, data);
    const user = await this.findById(id);
    if (!user) {
      throw new Error(`User with id ${id} not found after update`);
    }
    return user;
  }


  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async delete(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }
}

