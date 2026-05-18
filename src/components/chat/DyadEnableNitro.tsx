import React from "react";
import { Server } from "lucide-react";
import {
  ProteaAICard,
  ProteaAICardHeader,
  ProteaAIBadge,
  ProteaAIStateIndicator,
} from "./DyadCardPrimitives";
import { CustomTagState } from "./stateTypes";

interface DyadEnableNitroProps {
  state?: CustomTagState;
}

export const DyadEnableNitro: React.FC<DyadEnableNitroProps> = ({ state }) => {
  const isPending = state === "pending";
  const isAborted = state === "aborted";
  const headline = isPending
    ? "Adding Nitro server layer"
    : isAborted
      ? "Nitro server layer setup aborted"
      : "Added Nitro server layer";
  return (
    <ProteaAICard accentColor="emerald" state={state}>
      <ProteaAICardHeader icon={<Server size={15} />} accentColor="emerald">
        <ProteaAIBadge color="emerald">Server layer</ProteaAIBadge>
        <span className="text-sm font-medium text-foreground">{headline}</span>
        {state && (
          <ProteaAIStateIndicator state={state} abortedLabel="Did not finish" />
        )}
      </ProteaAICardHeader>
      {!isPending && !isAborted && (
        <div className="px-3 pb-3">
          <p className="text-xs text-muted-foreground leading-snug">
            API routes can now live under{" "}
            <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-muted">
              server/routes/api/
            </code>
          </p>
        </div>
      )}
    </ProteaAICard>
  );
};
