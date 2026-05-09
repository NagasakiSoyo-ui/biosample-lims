"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEVEL_ICON } from "@/server/services/locations";
import type { TreeNode } from "./locations-shell";

export function LocationTree({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: TreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="space-y-0.5 text-sm">
      {nodes.map((n) => (
        <TreeRow
          key={n.id}
          node={n}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

function TreeRow({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <li>
      <div
        className={cn(
          "flex cursor-pointer items-center gap-1 rounded-md px-1 py-1 hover:bg-accent",
          isSelected && "bg-accent font-medium",
          !node.isActive && "opacity-50",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={expanded ? "折叠" : "展开"}
            className="flex h-4 w-4 items-center justify-center text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="inline-block h-4 w-4" />
        )}
        <span aria-hidden>{LEVEL_ICON[node.level]}</span>
        <span className="truncate">{node.name}</span>
        {node.level === "BOX" && (
          <span className="ml-auto pl-1 text-xs text-muted-foreground">
            {node.sampleCount}/{node.capacity ?? "?"}
          </span>
        )}
      </div>
      {hasChildren && expanded && (
        <ul className="space-y-0.5">
          {node.children.map((c) => (
            <TreeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
