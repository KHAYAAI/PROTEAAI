import React, { useState } from "react";
import { CustomTagState } from "./stateTypes";
import { FolderOpen } from "lucide-react";
import {
  ProteaAICard,
  ProteaAICardHeader,
  ProteaAIBadge,
  ProteaAIExpandIcon,
  ProteaAIStateIndicator,
  ProteaAICardContent,
} from "./DyadCardPrimitives";

interface DyadListFilesProps {
  node: {
    properties: {
      directory?: string;
      recursive?: string;
      include_ignored?: string;
      state?: CustomTagState;
      appName?: string;
    };
  };
  children: React.ReactNode;
}

export function DyadListFiles({ node, children }: DyadListFilesProps) {
  const { directory, recursive, include_ignored, state, appName } =
    node.properties;
  const isLoading = state === "pending";
  const isRecursive = recursive === "true";
  const isIncludeIgnored = include_ignored === "true";
  const content = typeof children === "string" ? children : "";
  const [isExpanded, setIsExpanded] = useState(false);

  const title = directory ? directory : "List Files";

  return (
    <ProteaAICard
      state={state}
      accentColor="slate"
      isExpanded={isExpanded}
      onClick={() => setIsExpanded(!isExpanded)}
      data-testid="dyad-list-files"
    >
      <ProteaAICardHeader icon={<FolderOpen size={15} />} accentColor="slate">
        <span className="font-medium text-sm text-foreground truncate">
          {title}
        </span>
        {appName && <ProteaAIBadge color="sky">{appName}</ProteaAIBadge>}
        {isRecursive && <ProteaAIBadge color="slate">recursive</ProteaAIBadge>}
        {isIncludeIgnored && (
          <ProteaAIBadge color="slate">include ignored</ProteaAIBadge>
        )}
        {isLoading && (
          <ProteaAIStateIndicator state="pending" pendingLabel="Listing..." />
        )}
        <div className="ml-auto">
          <ProteaAIExpandIcon isExpanded={isExpanded} />
        </div>
      </ProteaAICardHeader>
      <ProteaAICardContent isExpanded={isExpanded}>
        {content && (
          <div className="p-3 text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto bg-muted/20 rounded-lg">
            {content}
          </div>
        )}
      </ProteaAICardContent>
    </ProteaAICard>
  );
}
