import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { CustomTagState } from "./stateTypes";
import { BookOpen } from "lucide-react";
import {
  ProteaAICard,
  ProteaAICardHeader,
  ProteaAIBadge,
  ProteaAIExpandIcon,
  ProteaAIStateIndicator,
  ProteaAICardContent,
} from "./DyadCardPrimitives";

interface DyadReadGuideProps {
  node: {
    properties: {
      name?: string;
      state?: CustomTagState;
    };
  };
  children: React.ReactNode;
}

export function DyadReadGuide({ node, children }: DyadReadGuideProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useTranslation("chat");
  const { name, state } = node.properties;
  const isLoading = state === "pending";
  const isAborted = state === "aborted";

  return (
    <ProteaAICard
      state={state}
      accentColor="indigo"
      isExpanded={isExpanded}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <ProteaAICardHeader icon={<BookOpen size={15} />} accentColor="indigo">
        <ProteaAIBadge color="indigo">{t("guide")}</ProteaAIBadge>
        {name && (
          <span className="text-sm text-foreground truncate">{name}</span>
        )}
        {isLoading && <ProteaAIStateIndicator state="pending" />}
        {isAborted && <ProteaAIStateIndicator state="aborted" />}
        <div className="ml-auto">
          <ProteaAIExpandIcon isExpanded={isExpanded} />
        </div>
      </ProteaAICardHeader>
      <ProteaAICardContent isExpanded={isExpanded}>
        {children && (
          <div className="p-3 text-xs font-mono whitespace-pre-wrap max-h-80 overflow-y-auto bg-muted/20 rounded-lg">
            {children}
          </div>
        )}
      </ProteaAICardContent>
    </ProteaAICard>
  );
}
