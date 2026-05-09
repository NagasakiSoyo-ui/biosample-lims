"use client";

import { Controller, type Control } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomFieldSpec } from "@/server/services/samples";

export function DynamicFields({
  schema,
  control,
}: {
  schema: CustomFieldSpec[];
  // RHF control instance from the parent form. Field name path is
  // `customFields.<key>`.
  control: Control<Record<string, unknown>>;
}) {
  if (schema.length === 0) {
    return (
      <p className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
        当前样本类型未配置专属字段
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {schema.map((field) => {
        const name = `customFields.${field.key}`;
        return (
          <div key={field.key} className="space-y-1.5">
            <Label className="text-sm">
              {field.label}
              {field.required && <span className="ml-0.5 text-rose-600">*</span>}
            </Label>
            <Controller
              control={control}
              name={name}
              render={({ field: f }) => {
                if (field.type === "text") {
                  return (
                    <Input
                      value={(f.value as string | undefined) ?? ""}
                      onChange={(e) => f.onChange(e.target.value)}
                    />
                  );
                }
                if (field.type === "number") {
                  return (
                    <Input
                      type="number"
                      step="any"
                      value={(f.value as string | number | undefined) ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        f.onChange(v === "" ? "" : Number(v));
                      }}
                    />
                  );
                }
                if (field.type === "date") {
                  return (
                    <Input
                      type="date"
                      value={(f.value as string | undefined) ?? ""}
                      onChange={(e) => f.onChange(e.target.value)}
                    />
                  );
                }
                if (field.type === "select") {
                  return (
                    <Select
                      value={(f.value as string | undefined) ?? ""}
                      onValueChange={(v) => f.onChange(v ?? "")}
                      items={Object.fromEntries(
                        (field.options ?? []).map((o) => [o, o]),
                      )}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择" />
                      </SelectTrigger>
                      <SelectContent>
                        {(field.options ?? []).map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                }
                if (field.type === "boolean") {
                  return (
                    <div className="flex h-9 items-center gap-2">
                      <Checkbox
                        checked={f.value === true}
                        onCheckedChange={(v) => f.onChange(v === true)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {f.value === true ? "是" : "否"}
                      </span>
                    </div>
                  );
                }
                return <Input value="" disabled />;
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
