import { Controller, Post, Get, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { RecordingsService } from "./recordings.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { RequestUploadUrlInput, LinkRecordingInput } from "@telecalling-crm/shared";

@ApiTags("recordings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("recordings")
export class RecordingsController {
  constructor(private readonly recordingsService: RecordingsService) {}

  @ApiOperation({ summary: "Get presigned S3/MinIO upload URL for recording file" })
  @Post("upload-url")
  getUploadUrl(@Body() body: RequestUploadUrlInput) {
    return this.recordingsService.getPresignedUploadUrl(body);
  }

  @ApiOperation({ summary: "Link uploaded recording file to CallLog" })
  @Post()
  link(@Body() body: LinkRecordingInput) {
    return this.recordingsService.linkRecording(body);
  }

  @ApiOperation({ summary: "Get short-lived playback URL for dashboard" })
  @Get(":id/url")
  getPlaybackUrl(@Param("id") id: string) {
    return this.recordingsService.getPlaybackUrl(id);
  }
}
