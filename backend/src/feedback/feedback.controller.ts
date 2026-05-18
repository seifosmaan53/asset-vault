import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto';

@Controller('feedback')
@UseGuards(ClerkAuthGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  create(@Body() createDto: CreateFeedbackDto, @Request() req) {
    try {
      const result = this.feedbackService.create(req.user.userId, createDto);
      return result;
    } catch (error: any) {
      throw error;
    }
  }
}

