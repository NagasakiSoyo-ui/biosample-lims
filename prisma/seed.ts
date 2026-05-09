import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type CustomField = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "boolean";
  required: boolean;
  options?: string[];
};

async function main() {
  // -- 1. Admin user ---------------------------------------------------------
  const passwordHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@reshen.local" },
    update: { name: "管理员", role: "ADMIN", passwordHash },
    create: {
      email: "admin@reshen.local",
      name: "管理员",
      passwordHash,
      role: "ADMIN",
    },
  });

  // -- 2. SampleTypes --------------------------------------------------------
  const sampleTypes: Array<{
    name: string;
    code: string;
    icon: string;
    description: string;
    fields: CustomField[];
  }> = [
    {
      name: "细胞",
      code: "CELL",
      icon: "🧫",
      description: "通用细胞样本",
      fields: [
        { key: "passage", label: "代次", type: "number", required: true },
        { key: "viability", label: "活率%", type: "number", required: false },
        { key: "cellCount", label: "细胞数", type: "number", required: false },
        { key: "medium", label: "培养基", type: "text", required: false },
        { key: "isFrozen", label: "是否冻存", type: "boolean", required: false },
      ],
    },
    {
      name: "TIL",
      code: "TIL",
      icon: "🦠",
      description: "肿瘤浸润淋巴细胞",
      fields: [
        { key: "passage", label: "代次", type: "number", required: false },
        { key: "viability", label: "活率%", type: "number", required: false },
        { key: "expansionRound", label: "扩增轮次", type: "number", required: false },
        { key: "cd3Percent", label: "CD3+%", type: "number", required: false },
        { key: "cd8Percent", label: "CD8+%", type: "number", required: false },
      ],
    },
    {
      name: "PBMC",
      code: "PBMC",
      icon: "🩸",
      description: "外周血单个核细胞",
      fields: [
        { key: "isolationDate", label: "分离日期", type: "date", required: false },
        { key: "viability", label: "活率%", type: "number", required: false },
        { key: "cellCount", label: "细胞数", type: "number", required: false },
        { key: "isFrozen", label: "是否冻存", type: "boolean", required: false },
      ],
    },
    {
      name: "血清",
      code: "SER",
      icon: "💧",
      description: "血清样本",
      fields: [
        { key: "volumeML", label: "体积mL", type: "number", required: true },
        { key: "isInactivated", label: "是否灭活", type: "boolean", required: false },
        {
          key: "tubeType",
          label: "采集管类型",
          type: "select",
          required: false,
          options: ["SST", "EDTA", "Heparin", "Other"],
        },
      ],
    },
    {
      name: "血浆",
      code: "PLA",
      icon: "💉",
      description: "血浆样本",
      fields: [
        { key: "volumeML", label: "体积mL", type: "number", required: false },
        {
          key: "anticoagulant",
          label: "抗凝剂",
          type: "select",
          required: false,
          options: ["EDTA", "Heparin", "Citrate"],
        },
      ],
    },
    {
      name: "组织",
      code: "TIS",
      icon: "🧠",
      description: "组织样本",
      fields: [
        { key: "weightMG", label: "重量mg", type: "number", required: false },
        { key: "siteOfOrigin", label: "取材部位", type: "text", required: false },
        {
          key: "preservation",
          label: "保存方式",
          type: "select",
          required: false,
          options: ["FFPE", "Fresh", "Frozen", "RNA-later"],
        },
      ],
    },
  ];

  for (const t of sampleTypes) {
    await prisma.sampleType.upsert({
      where: { code: t.code },
      update: {
        name: t.name,
        icon: t.icon,
        description: t.description,
        customFieldsSchema: t.fields as unknown as Prisma.InputJsonValue,
        isActive: true,
      },
      create: {
        name: t.name,
        code: t.code,
        icon: t.icon,
        description: t.description,
        customFieldsSchema: t.fields as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // -- 3. Projects -----------------------------------------------------------
  const projects: Array<{
    name: string;
    code: string;
    purpose: "RESEARCH" | "CLINICAL_INFUSION";
  }> = [
    { name: "GBM-TIL 研究", code: "GBM", purpose: "RESEARCH" },
    { name: "精索静脉曲张附睾脂肪 TIL 研究", code: "VAR", purpose: "RESEARCH" },
    { name: "人瘢痕成纤维细胞", code: "HF", purpose: "RESEARCH" },
    { name: "卵巢癌患者样本队列", code: "OV", purpose: "RESEARCH" },
    { name: "脐带 MSC 回输", code: "UC-MSC", purpose: "CLINICAL_INFUSION" },
    { name: "PBMC 回输", code: "PBMC-INF", purpose: "CLINICAL_INFUSION" },
    { name: "个人 ADSC 回输", code: "ADSC", purpose: "CLINICAL_INFUSION" },
  ];

  for (const p of projects) {
    await prisma.project.upsert({
      where: { code: p.code },
      update: { name: p.name, purpose: p.purpose, isActive: true },
      create: p,
    });
  }

  // -- 4. SourceOrgs ---------------------------------------------------------
  const sourceOrgs = [
    { name: "上海某三甲医院", type: "医院" },
    { name: "内部研发", type: "内部" },
    { name: "待定", type: "其他" },
  ];

  for (const o of sourceOrgs) {
    await prisma.sourceOrg.upsert({
      where: { name: o.name },
      update: { type: o.type, isActive: true },
      create: o,
    });
  }

  // -- 5. Location tree (rebuild bottom-up; safe while no Sample rows exist) -
  // Only resets when no Sample references a Location yet.
  const sampleWithLocation = await prisma.sample.count({
    where: { locationId: { not: null } },
  });

  if (sampleWithLocation === 0) {
    await prisma.location.deleteMany({ where: { level: "SLOT" } });
    await prisma.location.deleteMany({ where: { level: "BOX" } });
    await prisma.location.deleteMany({ where: { level: "CANISTER" } });
    await prisma.location.deleteMany({ where: { level: "TANK" } });

    const tankA = await prisma.location.create({
      data: { name: "液氮罐A", code: "TANK-A", level: "TANK", notes: "液氮罐" },
    });
    const canister1 = await prisma.location.create({
      data: {
        name: "提筒1",
        code: "TANK-A-C1",
        level: "CANISTER",
        parentId: tankA.id,
      },
    });
    await prisma.location.create({
      data: {
        name: "盒1",
        code: "TANK-A-C1-B1",
        level: "BOX",
        parentId: canister1.id,
        gridRows: 10,
        gridCols: 10,
        capacity: 100,
      },
    });
    await prisma.location.create({
      data: {
        name: "-80℃冰箱1",
        code: "FREEZER-1",
        level: "TANK",
        notes: "冰箱",
      },
    });
  } else {
    console.log(
      `跳过 Location 重建：已有 ${sampleWithLocation} 条 Sample 引用了 Location。`,
    );
  }

  // -- Done ------------------------------------------------------------------
  const counts = {
    User: await prisma.user.count(),
    SampleType: await prisma.sampleType.count(),
    Project: await prisma.project.count(),
    SourceOrg: await prisma.sourceOrg.count(),
    Location: await prisma.location.count(),
  };
  console.log("Seed done. Admin id:", admin.id);
  console.table(counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
