import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback } from './entities/feedback.entity';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private feedbackRepository: Repository<Feedback>,
  ) {}

  async create(userId: string, data: Partial<Feedback>): Promise<Feedback> {
    const feedback = this.feedbackRepository.create({
      ...data,
      userId,
    });
    return this.feedbackRepository.save(feedback);
  }
}

