import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import type { AuthenticatedRequest } from '../users/interfaces/authenticated-request.interface';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('feedback')
@Controller('feedback')
@UseGuards(ClerkAuthGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  create(
    @Body() createDto: CreateFeedbackDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const result = this.feedbackService.create(req.user.userId, createDto);
    return result;
  }
}
