import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { CustomTagState } from "./stateTypes";
import { Database } from "lucide-react";
import {
  ProteaAICard,
  ProteaAICardHeader,
  ProteaAIBadge,
  ProteaAIExpandIcon,
  ProteaAIStateIndicator,
  ProteaAICardContent,
} from "./DyadCardPrimitives";

interface DyadDbProjectInfoProps {
  provider: string;
  node: {
    properties: {
      state?: CustomTagState;
    };
  };
  children: React.ReactNode;
}

export function DyadDbProjectInfo({
  provider,
  node,
  children,
}: DyadDbProjectInfoProps) {
  const { t } = useTranslation("home");
  const [isContentVisible, setIsContentVisible] = useState(false);
  const { state } = node.properties;
  const isLoading = state === "pending";
  const isAborted = state === "aborted";
  const content = typeof children === "string" ? children : "";

  return (
    <ProteaAICard
      state={state}
      accentColor="teal"
      isExpanded={isContentVisible}
      onClick={() => setIsContentVisible(!isContentVisible)}
    >
      <ProteaAICardHeader icon={<Database size={15} />} accentColor="teal">
        <ProteaAIBadge color="teal">
          {t("integrations.db.projectInfo", { provider })}
        </ProteaAIBadge>
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
