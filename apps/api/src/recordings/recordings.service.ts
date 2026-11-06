import {
  Injectable,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUploadUrlInput, LinkRecordingInput } from "@telecalling-crm/shared";

@Injectable()
export class RecordingsService implements OnModuleInit {
  private readonly logger = new Logger(RecordingsService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(private readonly prisma: PrismaService) {
    this.bucket = process.env.S3_BUCKET || "recordings";

    const endpoint = process.env.S3_ENDPOINT || "http://localhost:9000";
    const region = process.env.S3_REGION || "ap-south-1";
    const accessKeyId = process.env.S3_ACCESS_KEY || "minioadmin";
    const secretAccessKey = process.env.S3_SECRET_KEY || "minioadmin";
    const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";

    this.s3Client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle,
    });
  }

  async onModuleInit() {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`S3 bucket '${this.bucket}' is ready`);
    } catch {
      try {
        await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created S3 bucket '${this.bucket}'`);
      } catch (err: any) {
        this.logger.warn(`Could not verify/create S3 bucket '${this.bucket}': ${err.message}`);
      }
    }
  }

  async getPresignedUploadUrl(data: RequestUploadUrlInput) {
    const timestamp = Date.now();
    const cleanName = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `recordings/${new Date().toISOString().slice(0, 10)}/${timestamp}_${cleanName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: "audio/mp4", // Or m4a/amr/wav depending on device
    });

    const expiresInSec = 600; // 10 minutes
    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSec,
    });

    return {
      success: true,
      data: {
        uploadUrl,
        storageKey,
        expiresInSec,
      },
    };
  }

  async linkRecording(data: LinkRecordingInput) {
    const call = await this.prisma.callLog.findUnique({
      where: { id: data.callLogId },
    });

    if (!call) {
      throw new NotFoundException(`Call ${data.callLogId} not found`);
    }

    const recording = await this.prisma.recording.create({
      data: {
        callLogId: data.callLogId,
        storageKey: data.storageKey,
        source: data.source ?? "PHONE_FILE",
        durationSec: data.durationSec ?? call.durationSec,
        sizeBytes: data.sizeBytes ?? 0,
        status: "UPLOADED",
      },
    });

    await this.prisma.callLog.update({
      where: { id: data.callLogId },
      data: { recordingId: recording.id },
    });

    return { success: true, data: recording };
  }

  async getPlaybackUrl(id: string) {
    const recording = await this.prisma.recording.findUnique({
      where: { id },
    });

    if (!recording) {
      throw new NotFoundException(`Recording ${id} not found`);
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: recording.storageKey,
    });

    const expiresInSec = 600; // 10 minutes
    const url = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSec,
    });

    return {
      success: true,
      data: {
        url,
        expiresInSec,
      },
    };
  }
}
