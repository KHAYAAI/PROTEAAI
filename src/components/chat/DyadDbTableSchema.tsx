import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { CustomTagState } from "./stateTypes";
import { Table2 } from "lucide-react";
import {
  ProteaAICard,
  ProteaAICardHeader,
  ProteaAIBadge,
  ProteaAIExpandIcon,
  ProteaAIStateIndicator,
  ProteaAICardContent,
} from "./DyadCardPrimitives";

interface DyadDbTableSchemaProps {
  provider: string;
  node: {
    properties: {
      table?: string;
      state?: CustomTagState;
    };
  };
  children: React.ReactNode;
}

export function DyadDbTableSchema({
  provider,
  node,
  children,
}: DyadDbTableSchemaProps) {
  const { t } = useTranslation("home");
  const [isContentVisible, setIsContentVisible] = useState(false);
  const { table, state } = node.properties;
  const isLoading = state === "pending";
  const isAborted = state === "aborted";
  const content = typeof children === "string" ? children : "";

  return (
    <ProteaAICard
      state={state}
      accentColor="teal"
      onClick={() => setIsContentVisible(!isContentVisible)}
      isExpanded={isContentVisible}
    >
      <ProteaAICardHeader icon={<Table2 size={15} />} accentColor="teal">
        <ProteaAIBadge color="teal">
          {table
            ? t("integrations.db.tableSchema")
            : t("integrations.db.tableSchemaProvider", { provider })}
        </ProteaAIBadge>
        {table && (
          <span className="font-medium text-sm text-foreground truncate">
            {table}
          </span>
        )}
        {isLoading && (
          <ProteaAIStateIndicator
            state="pending"
            pendingLabel={t("integrations.db.fetching")}
          />
        )}
        {isAborted && (
          <ProteaAIStateIndicator
            state="aborted"
            abortedLabel={t("integrations.db.didNotFinish")}
          />
        )}
        <div className="ml-auto">
          <ProteaAIExpandIcon isExpanded={isContentVisible} />
        </div>
      </ProteaAICardHeader>
      <ProteaAICardContent isExpanded={isContentVisible}>
        {content && (
          <div className="p-3 text-xs font-mono whitespace-pre-wrap max-h-80 overflow-y-auto bg-muted/20 rounded-lg">
            {content}
          </div>
        )}
      </ProteaAICardContent>
    </ProteaAICard>
  );
}
