import { PageHeader } from "@/components/shared/page-header";
import { ImportClient } from "./import-client";

export const metadata = { title: "Excel 导入 · BioSample LIMS" };

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[
          { label: "首页", href: "/" },
          { label: "样本", href: "/samples" },
          { label: "Excel 导入" },
        ]}
        title="Excel 批量导入"
        description="按模板填写后上传，支持自动创建未存在的孔位。"
      />
      <ImportClient />
    </div>
  );
}
