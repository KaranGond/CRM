import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 1. Seed Users
  const admin = await prisma.user.upsert({
    where: { email: "admin@telecalling.crm" },
    update: {},
    create: {
      email: "admin@telecalling.crm",
      name: "Super Admin",
      phone: "+919800000001",
      role: "admin",
      passwordHash,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@telecalling.crm" },
    update: {},
    create: {
      email: "manager@telecalling.crm",
      name: "Operations Manager",
      phone: "+919800000002",
      role: "manager",
      passwordHash,
    },
  });

  const caller1 = await prisma.user.upsert({
    where: { email: "caller1@telecalling.crm" },
    update: {},
    create: {
      email: "caller1@telecalling.crm",
      name: "Amit Verma",
      phone: "+919876511223",
      role: "telecaller",
      passwordHash,
    },
  });

  const caller2 = await prisma.user.upsert({
    where: { email: "caller2@telecalling.crm" },
    update: {},
    create: {
      email: "caller2@telecalling.crm",
      name: "Sneha Rao",
      phone: "+919822333445",
      role: "telecaller",
      passwordHash,
    },
  });

  // 2. Register Devices
  await prisma.device.upsert({
    where: { id: "device-samsung-01" },
    update: {},
    create: {
      id: "device-samsung-01",
      userId: caller1.id,
      model: "Samsung Galaxy M34",
      androidVersion: "14",
      appVersion: "1.0.0",
      engineVersion: "1.0.0",
      diagnostics: {
        batteryOptimized: false,
        permissionsGranted: { CALL_PHONE: true, READ_CALL_LOG: true },
        recorderFolderConfigured: true,
      },
    },
  });

  await prisma.device.upsert({
    where: { id: "device-xiaomi-02" },
    update: {},
    create: {
      id: "device-xiaomi-02",
      userId: caller2.id,
      model: "Xiaomi Redmi Note 13",
      androidVersion: "14",
      appVersion: "1.0.0",
      engineVersion: "1.0.0",
      diagnostics: {
        batteryOptimized: false,
        permissionsGranted: { CALL_PHONE: true, READ_CALL_LOG: true },
        recorderFolderConfigured: true,
      },
    },
  });

  // 3. Seed Pipeline Stages
  const stageNew = await prisma.pipelineStage.upsert({
    where: { id: "stage-new-lead" },
    update: {},
    create: {
      id: "stage-new-lead",
      label: "New Lead",
      order: 1,
    },
  });

  const stageContacted = await prisma.pipelineStage.upsert({
    where: { id: "stage-contacted" },
    update: {},
    create: {
      id: "stage-contacted",
      label: "Contacted",
      order: 2,
    },
  });

  const stageFollowUp = await prisma.pipelineStage.upsert({
    where: { id: "stage-follow-up" },
    update: {},
    create: {
      id: "stage-follow-up",
      label: "Follow Up Scheduled",
      order: 3,
    },
  });

  const stageConverted = await prisma.pipelineStage.upsert({
    where: { id: "stage-converted" },
    update: {},
    create: {
      id: "stage-converted",
      label: "Converted",
      order: 4,
    },
  });

  // 4. Seed Dispositions
  await prisma.dispositionType.upsert({
    where: { id: "disp-interested" },
    update: {},
    create: {
      id: "disp-interested",
      label: "Interested",
      order: 1,
      requiresFollowUp: true,
      setsStageId: stageFollowUp.id,
    },
  });

  await prisma.dispositionType.upsert({
    where: { id: "disp-callback" },
    update: {},
    create: {
      id: "disp-callback",
      label: "Callback Requested",
      order: 2,
      requiresFollowUp: true,
      setsStageId: stageFollowUp.id,
    },
  });

  await prisma.dispositionType.upsert({
    where: { id: "disp-deal-closed" },
    update: {},
    create: {
      id: "disp-deal-closed",
      label: "Deal Closed / Converted",
      order: 3,
      requiresFollowUp: false,
      setsStageId: stageConverted.id,
    },
  });

  // 5. Seed Leads
  const leadsData = [
    {
      name: "Vikram Sharma",
      phoneE164: "+919876543210",
      source: "Website Inbound",
      stageId: stageNew.id,
      assigneeId: caller1.id,
      customFields: { notes: "Requested product walkthrough for 20 seats." },
    },
    {
      name: "Pooja Patel",
      phoneE164: "+919812345678",
      source: "Direct Referral",
      stageId: stageFollowUp.id,
      assigneeId: caller1.id,
      nextFollowUpAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      customFields: { notes: "Callback requested after 2 PM." },
    },
    {
      name: "Rajesh Nair",
      phoneE164: "+919723456789",
      source: "Meta Ads",
      stageId: stageContacted.id,
      assigneeId: caller2.id,
      customFields: { notes: "Decision maker for logistics operations." },
    },
    {
      name: "Ananya Deshmukh",
      phoneE164: "+919933445566",
      source: "Google Search",
      stageId: stageNew.id,
      assigneeId: caller2.id,
      customFields: { notes: "Looking for ERP telecalling integration." },
    },
  ];

  for (const lead of leadsData) {
    await prisma.lead.upsert({
      where: { phoneE164: lead.phoneE164 },
      update: {},
      create: lead,
    });
  }

  console.log("✅ Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
