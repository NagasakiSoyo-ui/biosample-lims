// Action constants written to AuditLog.action across the app.
//
// History note: Phase 4 used `ENABLE_*` / `DISABLE_*` for dictionary
// soft-delete and Phase 5 used `TRANSFER_SAMPLE`. The user's Phase 6 spec
// preferred `TOGGLE_*_ACTIVE` / `MOVE_SAMPLE`. Both forms are mapped here so
// the UI labels stay consistent regardless of which name was historically
// written.

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  // Sample lifecycle
  CREATE_SAMPLE: "创建样本",
  UPDATE_SAMPLE: "编辑样本",
  OUTBOUND_SAMPLE: "样本出库",
  TRANSFER_SAMPLE: "位置转移",
  MOVE_SAMPLE: "位置转移",
  FREEZE_THAW_SAMPLE: "冻融登记",
  DISCARD_SAMPLE: "销毁样本",
  BATCH_CREATE_SAMPLES: "批量分装",
  BATCH_IMPORT_SAMPLES: "批量导入",

  // Sample types
  CREATE_SAMPLE_TYPE: "创建样本类型",
  UPDATE_SAMPLE_TYPE: "编辑样本类型",
  TOGGLE_SAMPLE_TYPE_ACTIVE: "切换样本类型状态",
  ENABLE_SAMPLE_TYPE: "启用样本类型",
  DISABLE_SAMPLE_TYPE: "禁用样本类型",

  // Projects
  CREATE_PROJECT: "创建项目",
  UPDATE_PROJECT: "编辑项目",
  TOGGLE_PROJECT_ACTIVE: "切换项目状态",
  ENABLE_PROJECT: "启用项目",
  DISABLE_PROJECT: "禁用项目",

  // Source orgs
  CREATE_SOURCE_ORG: "创建来源单位",
  UPDATE_SOURCE_ORG: "编辑来源单位",
  TOGGLE_SOURCE_ORG_ACTIVE: "切换来源单位状态",
  ENABLE_SOURCE_ORG: "启用来源单位",
  DISABLE_SOURCE_ORG: "禁用来源单位",

  // Donors
  CREATE_DONOR: "创建供者",
  UPDATE_DONOR: "编辑供者",
  TOGGLE_DONOR_ACTIVE: "切换供者状态",
  ENABLE_DONOR: "启用供者",
  DISABLE_DONOR: "禁用供者",

  // Locations
  CREATE_LOCATION: "创建存储位置",
  UPDATE_LOCATION: "编辑存储位置",
  DELETE_LOCATION: "删除存储位置",
  TOGGLE_LOCATION_ACTIVE: "切换位置状态",
  ENABLE_LOCATION: "启用位置",
  DISABLE_LOCATION: "禁用位置",
  AUTO_CREATE_SLOT: "自动创建孔位",

  // Users
  CREATE_USER: "创建用户",
  UPDATE_USER: "编辑用户",
  TOGGLE_USER_ACTIVE: "切换用户状态",
  ENABLE_USER: "启用用户",
  DISABLE_USER: "停用用户",
  RESET_USER_PASSWORD: "重置密码",
};

// Always returns a string — falls back to the raw action when not in the map.
export function actionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action;
}

// Distinct entity types referenced in audit logs.
export const AUDIT_ENTITY_TYPES = [
  "Sample",
  "SampleType",
  "Project",
  "SourceOrg",
  "Donor",
  "Location",
  "User",
] as const;

export const AUDIT_ENTITY_LABEL: Record<string, string> = {
  Sample: "样本",
  SampleType: "样本类型",
  Project: "项目",
  SourceOrg: "来源单位",
  Donor: "供者",
  Location: "存储位置",
  User: "用户",
};
