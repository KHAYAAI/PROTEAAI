import React, { useDeferredValue, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ProteaAIWrite } from "./DyadWrite";
import { ProteaAIRename } from "./DyadRename";
import { ProteaAICopy } from "./DyadCopy";
import { ProteaAIDelete } from "./DyadDelete";
import { ProteaAIAddDependency } from "./DyadAddDependency";
import { ProteaAIExecuteSql } from "./DyadExecuteSql";
import { ProteaAILogs } from "./DyadLogs";
import { DyadGrep } from "./DyadGrep";
import { DyadAddIntegration } from "./DyadAddIntegration";
import { DyadEnableNitro } from "./DyadEnableNitro";
import { ProteaAIEdit } from "./DyadEdit";
import { ProteaAISearchReplace } from "./DyadSearchReplace";
import { ProteaAICodebaseContext } from "./DyadCodebaseContext";
import { ProteaAIThink } from "./DyadThink";
import { CodeHighlight } from "./CodeHighlight";
import { useAtomValue } from "jotai";
import { isStreamingByIdAtom, selectedChatIdAtom } from "@/atoms/chatAtoms";
import { CustomTagState } from "./stateTypes";
import { ProteaAIOutput } from "./DyadOutput";
import { ProteaAIProblemSummary } from "./DyadProblemSummary";
import { ipc } from "@/ipc/types";
import { ProteaAIMcpToolCall } from "./DyadMcpToolCall";
import { ProteaAIMcpToolResult } from "./DyadMcpToolResult";
import { ProteaAIWebSearchResult } from "./DyadWebSearchResult";
import { ProteaAIWebSearch } from "./DyadWebSearch";
import { ProteaAIWebCrawl } from "./DyadWebCrawl";
import { ProteaAIWebFetch } from "./DyadWebFetch";
import { ProteaAIImageGeneration } from "./DyadImageGeneration";
import { ProteaAICodeSearchResult } from "./DyadCodeSearchResult";
import { DyadCodeSearch } from "./DyadCodeSearch";
import { ProteaAIRead } from "./DyadRead";
import { DyadListFiles } from "./DyadListFiles";
import { ProteaAIDatabaseSchema } from "./DyadDatabaseSchema";
import { DyadDbTableSchema } from "./DyadDbTableSchema";
import { DyadSupabaseProjectInfo } from "./DyadSupabaseProjectInfo";
import { DyadNeonProjectInfo } from "./DyadNeonProjectInfo";
import { ProteaAIStatus } from "./DyadStatus";
import { ProteaAICompaction } from "./DyadCompaction";
import { ProteaAIWritePlan } from "./DyadWritePlan";
import { ProteaAIExitPlan } from "./DyadExitPlan";
import { ProteaAIQuestionnaire } from "./DyadQuestionnaire";
import { ProteaAIStepLimit } from "./DyadStepLimit";
import { DyadReadGuide } from "./DyadReadGuide";
import { DyadScript } from "./DyadScript";
import { mapActionToButton } from "./ChatInput";
import { SuggestedAction } from "@/lib/schemas";
import { FixAllErrorsButton } from "./FixAllErrorsButton";
import { unescapeXmlAttr, unescapeXmlContent } from "../../../shared/xmlEscape";

const DYAD_CUSTOM_TAGS = [
  "dyad-write",
  "dyad-rename",
  "dyad-delete",
  "dyad-add-dependency",
  "dyad-execute-sql",
  "dyad-read-logs",
  "dyad-add-integration",
  "dyad-enable-nitro",
  "dyad-output",
  "dyad-problem-report",
  "dyad-chat-summary",
  "dyad-edit",
  "dyad-grep",
  "dyad-search-replace",
  "dyad-codebase-context",
  "dyad-web-search-result",
  "dyad-web-search",
  "dyad-web-crawl",
  "dyad-web-fetch",
  "dyad-code-search-result",
  "dyad-code-search",
  "dyad-read",
  "think",
  "dyad-command",
  "dyad-mcp-tool-call",
  "dyad-mcp-tool-result",
  "dyad-list-files",
  "dyad-database-schema",
  "dyad-db-table-schema",
  "dyad-supabase-table-schema",
  "dyad-supabase-project-info",
  "dyad-neon-project-info",
  "dyad-neon-table-schema",
  "dyad-read-guide",
  "dyad-status",
  "dyad-compaction",
  "dyad-copy",
  "dyad-image-generation",
  // Plan mode tags
  "dyad-write-plan",
  "dyad-exit-plan",
  "dyad-questionnaire",
  // Step limit notification
  "dyad-step-limit",
  "dyad-script",
];

interface DyadMarkdownParserProps {
  content: string;
}

type CustomTagInfo = {
  tag: string;
  attributes: Record<string, string>;
  content: string;
  fullMatch: string;
  inProgress?: boolean;
};

type ContentPiece =
  | { type: "markdown"; content: string }
  | { type: "custom-tag"; tagInfo: CustomTagInfo };

const customLink = ({
  node: _node,
  ...props
}: {
  node?: any;
  [key: string]: any;
}) => (
  <a
    {...props}
    onClick={(e) => {
      const url = props.href;
      if (url) {
        e.preventDefault();
        ipc.system.openExternalUrl(url);
      }
    }}
  />
);

export const VanillaMarkdownParser = ({ content }: { content: string }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code: CodeHighlight,
        a: customLink,
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

/**
 * Custom component to parse markdown content with Dyad-specific tags
 */
export const DyadMarkdownParser: React.FC<DyadMarkdownParserProps> = ({
  content,
}) => {
  const chatId = useAtomValue(selectedChatIdAtom);
  const isStreaming = useAtomValue(isStreamingByIdAtom).get(chatId!) ?? false;
  const deferredContent = useDeferredValue(content);
  const contentToParse = isStreaming ? deferredContent : content;

  // Extract content pieces (markdown and custom tags)
  const contentPieces = useMemo(() => {
    return parseCustomTags(contentToParse);
  }, [contentToParse]);

  // Extract error messages and track positions
  const { errorMessages, lastErrorIndex, errorCount } = useMemo(() => {
    const errors: string[] = [];
    let lastIndex = -1;
    let count = 0;

    contentPieces.forEach((piece, index) => {
      if (
        piece.type === "custom-tag" &&
        piece.tagInfo.tag === "dyad-output" &&
        piece.tagInfo.attributes.type === "error"
      ) {
        const errorMessage = piece.tagInfo.attributes.message;
        if (errorMessage?.trim()) {
          errors.push(errorMessage.trim());
          count++;
          lastIndex = index;
        }
      }
    });

    return {
      errorMessages: errors,
      lastErrorIndex: lastIndex,
      errorCount: count,
    };
  }, [contentPieces]);

  return (
    <>
      {contentPieces.map((piece, index) => (
        <React.Fragment key={index}>
          {piece.type === "markdown" ? (
            piece.content && <MemoMarkdown content={piece.content} />
          ) : (
            <MemoCustomTag tagInfo={piece.tagInfo} isStreaming={isStreaming} />
          )}
          {index === lastErrorIndex &&
            errorCount > 1 &&
            !isStreaming &&
            chatId && (
              <div className="mt-3 w-full flex">
                <FixAllErrorsButton
                  errorMessages={errorMessages}
                  chatId={chatId}
                />
              </div>
            )}
        </React.Fragment>
      ))}
    </>
  );
};

// Module-level constants so MemoMarkdown never gets fresh refs for these
// props, which would defeat ReactMarkdown's internal prop-equality checks.
const REMARK_PLUGINS = [remarkGfm];
const MARKDOWN_COMPONENTS = { code: CodeHighlight, a: customLink };

// Memoized markdown piece. Without this, ReactMarkdown re-parses every
// completed segment's text into an AST on every streaming chunk —
// the dominant per-render cost during long streams. Memoizing on
// `content` lets completed segments skip that re-parse entirely.
const MemoMarkdown = React.memo(function MemoMarkdown({
  content,
}: {
  content: string;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      components={MARKDOWN_COMPONENTS}
    >
      {content}
    </ReactMarkdown>
  );
});

function tagInfoEqual(a: CustomTagInfo, b: CustomTagInfo): boolean {
  if (a.tag !== b.tag) return false;
  if (a.content !== b.content) return false;
  if (a.inProgress !== b.inProgress) return false;
  const aKeys = Object.keys(a.attributes);
  const bKeys = Object.keys(b.attributes);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a.attributes[k] !== b.attributes[k]) return false;
  }
  // fullMatch intentionally omitted: renderCustomTag never reads it, so two
  // tagInfo objects that differ only in fullMatch produce identical output.
  return true;
}

// Memoized custom-tag piece. parseCustomTags rebuilds tagInfo objects on
// every chunk (new refs), so React.memo's default referential equality
// would never hit. The custom comparator deep-checks the fields that
// actually affect the rendered output, so completed dyad tags skip
// renderCustomTag and the React subtree rebuild when only later pieces
// change.
const MemoCustomTag = React.memo(
  function MemoCustomTag({
    tagInfo,
    isStreaming,
  }: {
    tagInfo: CustomTagInfo;
    isStreaming: boolean;
  }) {
    return <>{renderCustomTag(tagInfo, { isStreaming })}</>;
  },
  (prev, next) =>
    tagInfoEqual(prev.tagInfo, next.tagInfo) &&
    // Completed tags don't use isStreaming (getState returns "finished"
    // regardless), so skip the check to avoid a one-time re-render of every
    // completed tag when streaming ends.
    (prev.tagInfo.inProgress === false ||
      prev.isStreaming === next.isStreaming),
);

/**
 * Pre-process content to handle unclosed custom tags
 * Adds closing tags at the end of the content for any unclosed custom tags
 * Assumes the opening tags are complete and valid
 * Returns the processed content and a map of in-progress tags
 */
function preprocessUnclosedTags(content: string): {
  processedContent: string;
  inProgressTags: Map<string, Set<number>>;
} {
  let processedContent = content;
  // Map to track which tags are in progress and their positions
  const inProgressTags = new Map<string, Set<number>>();

  // For each tag type, check if there are unclosed tags
  for (const tagName of DYAD_CUSTOM_TAGS) {
    // Count opening and closing tags
    const openTagPattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>`, "g");
    const closeTagPattern = new RegExp(`</${tagName}>`, "g");

    // Track the positions of opening tags
    const openingMatches: RegExpExecArray[] = [];
    let match;

    // Reset regex lastIndex to start from the beginning
    openTagPattern.lastIndex = 0;

    while ((match = openTagPattern.exec(processedContent)) !== null) {
      openingMatches.push({ ...match });
    }

    const openCount = openingMatches.length;
    const closeCount = (processedContent.match(closeTagPattern) || []).length;

    // If we have more opening than closing tags
    const missingCloseTags = openCount - closeCount;
    if (missingCloseTags > 0) {
      // Add the required number of closing tags at the end
      processedContent += Array(missingCloseTags)
        .fill(`</${tagName}>`)
        .join("");

      // Mark the last N tags as in progress where N is the number of missing closing tags
      const inProgressIndexes = new Set<number>();
      const startIndex = openCount - missingCloseTags;
      for (let i = startIndex; i < openCount; i++) {
        inProgressIndexes.add(openingMatches[i].index);
      }
      inProgressTags.set(tagName, inProgressIndexes);
    }
  }

  return { processedContent, inProgressTags };
}

/**
 * Parse the content to extract custom tags and markdown sections into a unified array
 */
function parseCustomTags(content: string): ContentPiece[] {
  const { processedContent, inProgressTags } = preprocessUnclosedTags(content);

  // Sort tags longest-first so e.g. "dyad-read-guide" is tried before "dyad-read".
  // The (?=[\s>]) lookahead ensures a tag name like "dyad-read" won't prefix-match
  // "dyad-read-guide" (the char after must be whitespace or '>').
  const sortedTags = [...DYAD_CUSTOM_TAGS].sort((a, b) => b.length - a.length);
  const tagPattern = new RegExp(
    `<(${sortedTags.join("|")})(?=[\\s>])\\s*([^>]*)>(.*?)<\\/\\1>`,
    "gs",
  );

  const contentPieces: ContentPiece[] = [];
  let lastIndex = 0;
  let match;

  // Find all custom tags
  while ((match = tagPattern.exec(processedContent)) !== null) {
    const [fullMatch, tag, attributesStr, tagContent] = match;
    const startIndex = match.index;

    // Add the markdown content before this tag
    if (startIndex > lastIndex) {
      contentPieces.push({
        type: "markdown",
        content: processedContent.substring(lastIndex, startIndex),
      });
    }

    // Parse attributes and unescape values
    const attributes: Record<string, string> = {};
    const attrPattern = /([\w-]+)="([^"]*)"/g;
    let attrMatch;
    while ((attrMatch = attrPattern.exec(attributesStr)) !== null) {
      attributes[attrMatch[1]] = unescapeXmlAttr(attrMatch[2]);
    }

    // Check if this tag was marked as in progress
    const tagInProgressSet = inProgressTags.get(tag);
    const isInProgress = tagInProgressSet?.has(startIndex);

    // Add the tag info with unescaped content
    contentPieces.push({
      type: "custom-tag",
      tagInfo: {
        tag,
        attributes,
        content: unescapeXmlContent(tagContent),
        fullMatch,
        inProgress: isInProgress || false,
      },
    });

    lastIndex = startIndex + fullMatch.length;
  }

  // Add the remaining markdown content
  if (lastIndex < processedContent.length) {
    contentPieces.push({
      type: "markdown",
      content: processedContent.substring(lastIndex),
    });
  }

  return contentPieces;
}

function getState({
  isStreaming,
  inProgress,
  explicitState,
}: {
  isStreaming?: boolean;
  inProgress?: boolean;
  explicitState?: string;
}): CustomTagState {
  if (explicitState === "aborted" || explicitState === "finished") {
    return explicitState;
  }
  if (explicitState === "in-progress" || explicitState === "pending") {
    return "pending";
  }
  if (!inProgress) {
    return "finished";
  }
  return isStreaming ? "pending" : "aborted";
}

/**
 * Render a custom tag based on its type
 */
function renderCustomTag(
  tagInfo: CustomTagInfo,
  { isStreaming }: { isStreaming: boolean },
): React.ReactNode {
  const { tag, attributes, content, inProgress } = tagInfo;

  switch (tag) {
    case "dyad-read":
      return (
        <ProteaAIRead
          node={{
            properties: {
              path: attributes.path || "",
              startLine: attributes.start_line || "",
              endLine: attributes.end_line || "",
              appName: attributes.app_name || "",
            },
          }}
        >
          {content}
        </ProteaAIRead>
      );
    case "dyad-web-search":
      return (
        <ProteaAIWebSearch
          node={{
            properties: {
              query: attributes.query || "",
              state: getState({ isStreaming, inProgress }),
            },
          }}
        >
          {content}
        </ProteaAIWebSearch>
      );
    case "dyad-web-crawl":
      return (
        <ProteaAIWebCrawl
          node={{
            properties: {},
          }}
        >
          {content}
        </ProteaAIWebCrawl>
      );
    case "dyad-web-fetch":
      return (
        <ProteaAIWebFetch
          node={{
            properties: {
              state: getState({ isStreaming, inProgress }),
            },
          }}
        >
          {content}
        </ProteaAIWebFetch>
      );
    case "dyad-code-search":
      return (
        <DyadCodeSearch
          node={{
            properties: {
              query: attributes.query || "",
              state: getState({ isStreaming, inProgress }),
              appName: attributes.app_name || "",
            },
          }}
        >
          {content}
        </DyadCodeSearch>
      );
    case "dyad-code-search-result":
      return (
        <ProteaAICodeSearchResult
          node={{
            properties: {},
          }}
        >
          {content}
        </ProteaAICodeSearchResult>
      );
    case "dyad-web-search-result":
      return (
        <ProteaAIWebSearchResult
          node={{
            properties: {
              state: getState({ isStreaming, inProgress }),
            },
          }}
        >
          {content}
        </ProteaAIWebSearchResult>
      );
    case "think":
      return (
        <ProteaAIThink
          node={{
            properties: {
              state: getState({ isStreaming, inProgress }),
            },
          }}
        >
          {content}
        </ProteaAIThink>
      );
    case "dyad-write":
      return (
        <ProteaAIWrite
          node={{
            properties: {
              path: attributes.path || "",
              description: attributes.description || "",
              state: getState({ isStreaming, inProgress }),
            },
          }}
        >
          {content}
        </ProteaAIWrite>
      );

    case "dyad-rename":
      return (
        <ProteaAIRename
          node={{
            properties: {
              from: attributes.from || "",
              to: attributes.to || "",
            },
          }}
        >
          {content}
        </ProteaAIRename>
      );

    case "dyad-copy":
      return (
        <ProteaAICopy
          node={{
            properties: {
              from: attributes.from || "",
              to: attributes.to || "",
              description: attributes.description || "",
              state: getState({ isStreaming, inProgress }),
            },
          }}
        >
          {content}
        </ProteaAICopy>
      );

    case "dyad-delete":
      return (
        <ProteaAIDelete
          node={{
            properties: {
              path: attributes.path || "",
            },
          }}
        >
          {content}
        </ProteaAIDelete>
      );

    case "dyad-add-dependency":
      return (
        <ProteaAIAddDependency
          node={{
            properties: {
              packages: attributes.packages || "",
            },
          }}
        >
          {content}
        </ProteaAIAddDependency>
      );

    case "dyad-execute-sql":
      return (
        <ProteaAIExecuteSql
          node={{
            properties: {
              state: getState({ isStreaming, inProgress }),
              description: attributes.description || "",
            },
          }}
        >
          {content}
        </ProteaAIExecuteSql>
      );

    case "dyad-read-logs":
      return (
        <ProteaAILogs
          node={{
            properties: {
              state: getState({ isStreaming, inProgress }),
              time: attributes.time || "",
              type: attributes.type || "",
              level: attributes.level || "",
              count: attributes.count || "",
            },
          }}
        >
          {content}
        </ProteaAILogs>
      );

    case "dyad-grep":
      return (
        <DyadGrep
          node={{
            properties: {
              state: getState({ isStreaming, inProgress }),
              query: attributes.query || "",
              include: attributes.include || "",
              exclude: attributes.exclude || "",
              "case-sensitive": attributes["case-sensitive"] || "",
              count: attributes.count || "",
              total: attributes.total || "",
              truncated: attributes.truncated || "",
              appName: attributes.app_name || "",
            },
          }}
        >
          {content}
        </DyadGrep>
      );

    case "dyad-add-integration":
      return (
        <DyadAddIntegration
          provider={
            attributes.provider === "neon" || attributes.provider === "supabase"
              ? attributes.provider
              : undefined
          }
        >
          {content}
        </DyadAddIntegration>
      );

    case "dyad-enable-nitro":
      return <DyadEnableNitro state={getState({ isStreaming, inProgress })} />;

    case "dyad-edit":
      return (
        <ProteaAIEdit
          node={{
            properties: {
              path: attributes.path || "",
              description: attributes.description || "",
              state: getState({ isStreaming, inProgress }),
            },
          }}
        >
          {content}
        </ProteaAIEdit>
      );

    case "dyad-search-replace":
      return (
        <ProteaAISearchReplace
          node={{
            properties: {
              path: attributes.path || "",
              description: attributes.description || "",
              state: getState({ isStreaming, inProgress }),
            },
          }}
        >
          {content}
        </ProteaAISearchReplace>
      );

    case "dyad-codebase-context":
      return (
        <ProteaAICodebaseContext
          node={{
            properties: {
              files: attributes.files || "",
              state: getState({ isStreaming, inProgress }),
            },
          }}
        >
          {content}
        </ProteaAICodebaseContext>
      );

    case "dyad-mcp-tool-call":
      return (
        <ProteaAIMcpToolCall
          node={{
            properties: {
              serverName: attributes.server || "",
              toolName: attributes.tool || "",
            },
          }}
        >
          {content}
        </ProteaAIMcpToolCall>
      );

    case "dyad-mcp-tool-result":
      return (
        <ProteaAIMcpToolResult
          node={{
            properties: {
              serverName: attributes.server || "",
              toolName: attributes.tool || "",
            },
          }}
        >
          {content}
        </ProteaAIMcpToolResult>
      );

    case "dyad-output":
      return (
        <ProteaAIOutput
          type={attributes.type as "warning" | "error"}
          message={attributes.message}
        >
          {content}
        </ProteaAIOutput>
      );

    case "dyad-script":
      return (
        <DyadScript
          node={{
            properties: {
              description: attributes.description || "",
              truncated: attributes.truncated || "",
              executionMs: attributes["execution-ms"] || "",
              fullOutputPath: attributes["full-output-path"] || "",
            },
          }}
        >
          {content}
        </DyadScript>
      );

    case "dyad-problem-report":
      return (
        <ProteaAIProblemSummary summary={attributes.summary}>
          {content}
        </ProteaAIProblemSummary>
      );

    case "dyad-chat-summary":
      // Don't render anything for dyad-chat-summary
      return null;

    case "dyad-command":
      if (attributes.type) {
        const action = {
          id: attributes.type,
        } as SuggestedAction;
        return <>{mapActionToButton(action)}</>;
      }
      return null;

    case "dyad-list-files":
      return (
        <DyadListFiles
          node={{
            properties: {
              directory: attributes.directory || "",
              recursive: attributes.recursive || "",
              include_ignored:
                attributes.include_ignored || attributes.include_hidden || "",
              state: getState({ isStreaming, inProgress }),
              appName: attributes.app_name || "",
            },
          }}
        >
          {content}
        </DyadListFiles>
      );

    case "dyad-database-schema":
      return (
        <ProteaAIDatabaseSchema
          node={{
            properties: {
              state: getState({ isStreaming, inProgress }),
            },
          }}
        >
          {content}
        </ProteaAIDatabaseSchema>
      );

    case "dyad-db-table-schema":
    // Backward compat: old messages used provider-specific tags
    case "dyad-supabase-table-schema":
    case "dyad-neon-table-schema":
      return (
        <DyadDbTableSchema
          provider={
            tag === "dyad-supabase-table-schema"
              ? "Supabase"
              : tag === "dyad-neon-table-schema"
                ? "Neon"
                : (attributes.provider as string) || ""
          }
          node={{
            properties: {
              table: attributes.table || "",
              state: getState({ isStreaming, inProgress }),
            },
          }}
        >
          {content}
        </DyadDbTableSchema>
      );

    case "dyad-supabase-project-info":
      return (
        <DyadSupabaseProjectInfo
          node={{
            properties: {
              state: getState({ isStreaming, inProgress }),
            },
          }}
        >
          {content}
        </DyadSupabaseProjectInfo>
      );

    case "dyad-neon-project-info":
      return (
        <DyadNeonProjectInfo
          node={{
            properties: {
              state: getState({ isStreaming, inProgress }),
            },
          }}
        >
          {content}
        </DyadNeonProjectInfo>
      );

    case "dyad-read-guide":
      return (
        <ProteaAIReadGuide
          node={{
            properties: {
              name: attributes.name || "",
              state: getState({ isStreaming, inProgress }),
            },
          }}
        >
          {content}
        </ProteaAIReadGuide>
      );

    case "dyad-image-generation":
      return (
        <ProteaAIImageGeneration
          node={{
            properties: {
              prompt: attributes.prompt || "",
              path: attributes.path || "",
              state: getState({ isStreaming, inProgress }),
            },
          }}
        >
          {content}
        </ProteaAIImageGeneration>
      );

    case "dyad-status":
      return (
        <ProteaAIStatus
          node={{
            properties: {
              title: attributes.title || "Processing...",
              state: getState({
                isStreaming,
                inProgress,
                explicitState: attributes.state,
              }),
            },
          }}
        >
          {content}
        </ProteaAIStatus>
      );

    case "dyad-compaction":
      return (
        <ProteaAICompaction
          node={{
            properties: {
              title: attributes.title || "Compacting conversation",
              state: getState({ isStreaming, inProgress }),
            },
          }}
        >
          {content}
        </ProteaAICompaction>
      );

    case "dyad-write-plan":
      return (
        <ProteaAIWritePlan
          node={{
            properties: {
              title: attributes.title || "Implementation Plan",
              summary: attributes.summary,
              complete: attributes.complete,
              state: getState({ isStreaming, inProgress }),
            },
          }}
        >
          {content}
        </ProteaAIWritePlan>
      );

    case "dyad-exit-plan":
      return (
        <ProteaAIExitPlan
          node={{
            properties: {
              notes: attributes.notes,
            },
          }}
        />
      );

    case "dyad-questionnaire":
      return <ProteaAIQuestionnaire>{content}</ProteaAIQuestionnaire>;

    case "dyad-step-limit":
      return (
        <ProteaAIStepLimit
          node={{
            properties: {
              steps: attributes.steps,
              limit: attributes.limit,
              state: getState({ isStreaming, inProgress }),
            },
          }}
        >
          {content}
        </ProteaAIStepLimit>
      );

    default:
      return null;
  }
}
