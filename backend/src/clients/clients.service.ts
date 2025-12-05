import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private clientsRepository: Repository<Client>,
  ) {}

  async findAll(userId: string): Promise<Client[]> {
    return this.clientsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Client> {
    const client = await this.clientsRepository.findOne({
      where: { id, userId },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    return client;
  }

  async create(userId: string, data: Partial<Client>): Promise<Client> {
    const client = this.clientsRepository.create({
      ...data,
      userId,
    });
    return this.clientsRepository.save(client);
  }

  async update(id: string, userId: string, data: Partial<Client>): Promise<Client> {
    await this.findOne(id, userId);
    await this.clientsRepository.update({ id, userId }, data);
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const client = await this.findOne(id, userId);
    await this.clientsRepository.softRemove(client);
  }
}

