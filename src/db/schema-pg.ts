/**
 * PostgreSQL schema for Vercel/Neon deployments.
 * Mirrors schema.ts exactly but uses drizzle-orm/pg-core types.
 * Column names and structures are identical so all query code works unchanged.
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { ModelMessage } from "ai";
import type { StoredChatMode } from "@/lib/schemas";

// ── Users ─────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  role: text("role").$type<"user" | "admin">().notNull().default("user"),
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Subscriptions ─────────────────────────────────────────────────────────────

export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull().default(""),
  payfastToken: text("payfast_token"),
  paymentProvider: text("payment_provider").$type<"stripe" | "payfast">(),
  status: text("status")
    .$type<"active" | "canceled" | "past_due" | "trialing" | "incomplete">()
    .notNull()
    .default("active"),
  plan: text("plan").$type<"free" | "pro">().notNull().default("free"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── User Settings ─────────────────────────────────────────────────────────────

export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  settingsJson: text("settings_json").notNull().default("{}"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const AI_MESSAGES_SDK_VERSION = "ai@v6" as const;

export type AiMessagesJsonV6 = {
  messages: ModelMessage[];
  sdkVersion: typeof AI_MESSAGES_SDK_VERSION;
};

// ── Prompts ───────────────────────────────────────────────────────────────────

export const prompts = pgTable(
  "prompts",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    content: text("content").notNull(),
    slug: text("slug"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique("prompts_slug_unique").on(table.slug)],
);

// ── Apps ──────────────────────────────────────────────────────────────────────

export const apps = pgTable("apps", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  path: text("path").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  githubOrg: text("github_org"),
  githubRepo: text("github_repo"),
  githubBranch: text("github_branch"),
  supabaseProjectId: text("supabase_project_id"),
  supabaseParentProjectId: text("supabase_parent_project_id"),
  supabaseOrganizationSlug: text("supabase_organization_slug"),
  neonProjectId: text("neon_project_id"),
  neonDevelopmentBranchId: text("neon_development_branch_id"),
  neonPreviewBranchId: text("neon_preview_branch_id"),
  neonActiveBranchId: text("neon_active_branch_id"),
  vercelProjectId: text("vercel_project_id"),
  vercelProjectName: text("vercel_project_name"),
  vercelTeamId: text("vercel_team_id"),
  vercelDeploymentUrl: text("vercel_deployment_url"),
  installCommand: text("install_command"),
  startCommand: text("start_command"),
  chatContext: jsonb("chat_context"),
  isFavorite: boolean("is_favorite").notNull().default(false),
  themeId: text("theme_id"),
});

// ── Chats ─────────────────────────────────────────────────────────────────────

export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  appId: integer("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" }),
  title: text("title"),
  initialCommitHash: text("initial_commit_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  compactedAt: timestamp("compacted_at"),
  compactionBackupPath: text("compaction_backup_path"),
  pendingCompaction: boolean("pending_compaction"),
  chatMode: text("chat_mode").$type<StoredChatMode | null>(),
});

// ── Messages ──────────────────────────────────────────────────────────────────

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: text("role").$type<"user" | "assistant">().notNull(),
  content: text("content").notNull(),
  approvalState: text("approval_state").$type<"approved" | "rejected">(),
  sourceCommitHash: text("source_commit_hash"),
  commitHash: text("commit_hash"),
  requestId: text("request_id"),
  maxTokensUsed: integer("max_tokens_used"),
  model: text("model"),
  aiMessagesJson: jsonb("ai_messages_json").$type<AiMessagesJsonV6 | null>(),
  usingFreeAgentModeQuota: boolean("using_free_agent_mode_quota"),
  isCompactionSummary: boolean("is_compaction_summary"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Versions ──────────────────────────────────────────────────────────────────

export const versions = pgTable(
  "versions",
  {
    id: serial("id").primaryKey(),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    commitHash: text("commit_hash").notNull(),
    neonDbTimestamp: text("neon_db_timestamp"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("versions_app_commit_unique").on(table.appId, table.commitHash),
  ],
);

// ── Language Model Providers ──────────────────────────────────────────────────

export const language_model_providers = pgTable("language_model_providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  api_base_url: text("api_base_url").notNull(),
  env_var_name: text("env_var_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Language Models ───────────────────────────────────────────────────────────

export const language_models = pgTable("language_models", {
  id: serial("id").primaryKey(),
  displayName: text("display_name").notNull(),
  apiName: text("api_name").notNull(),
  builtinProviderId: text("builtin_provider_id"),
  customProviderId: text("custom_provider_id").references(
    () => language_model_providers.id,
    { onDelete: "cascade" },
  ),
  description: text("description"),
  max_output_tokens: integer("max_output_tokens"),
  context_window: integer("context_window"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── MCP Servers ───────────────────────────────────────────────────────────────

export const mcpServers = pgTable("mcp_servers", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  transport: text("transport").notNull(),
  command: text("command"),
  args: jsonb("args").$type<string[] | null>(),
  envJson: jsonb("env_json").$type<Record<string, string> | null>(),
  headersJson: jsonb("headers_json").$type<Record<string, string> | null>(),
  url: text("url"),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── MCP Tool Consents ─────────────────────────────────────────────────────────

export const mcpToolConsents = pgTable(
  "mcp_tool_consents",
  {
    id: serial("id").primaryKey(),
    serverId: integer("server_id")
      .notNull()
      .references(() => mcpServers.id, { onDelete: "cascade" }),
    toolName: text("tool_name").notNull(),
    consent: text("consent").notNull().default("ask"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique("uniq_mcp_consent").on(table.serverId, table.toolName)],
);

// ── Custom Themes ─────────────────────────────────────────────────────────────

export const customThemes = pgTable("custom_themes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  prompt: text("prompt").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Relations ─────────────────────────────────────────────────────────────────

export const appsRelations = relations(apps, ({ many }) => ({
  chats: many(chats),
  versions: many(versions),
}));

export const chatsRelations = relations(chats, ({ many, one }) => ({
  messages: many(messages),
  app: one(apps, { fields: [chats.appId], references: [apps.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, { fields: [messages.chatId], references: [chats.id] }),
}));

export const versionsRelations = relations(versions, ({ one }) => ({
  app: one(apps, { fields: [versions.appId], references: [apps.id] }),
}));

export const languageModelProvidersRelations = relations(
  language_model_providers,
  ({ many }) => ({ languageModels: many(language_models) }),
);

export const languageModelsRelations = relations(language_models, ({ one }) => ({
  provider: one(language_model_providers, {
    fields: [language_models.customProviderId],
    references: [language_model_providers.id],
  }),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  apps: many(apps),
  mcpServers: many(mcpServers),
  customThemes: many(customThemes),
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
}));
