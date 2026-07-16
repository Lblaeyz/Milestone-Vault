import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Off-chain agreement metadata ────────────────────────────────────────────
export const agreementsTable = pgTable("agreements", {
  id:              serial("id").primaryKey(),
  contractAddress: text("contract_address").notNull().unique(),
  investorAddress: text("investor_address").notNull(),
  builderAddress:  text("builder_address").notNull(),
  projectName:     text("project_name").notNull(),
  description:     text("description").notNull().default(""),
  txHash:          text("tx_hash"),
  chainId:         integer("chain_id").notNull().default(10143),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
});

export const insertAgreementSchema = createInsertSchema(agreementsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertAgreement = z.infer<typeof insertAgreementSchema>;
export type Agreement = typeof agreementsTable.$inferSelect;

// ── Off-chain request metadata ───────────────────────────────────────────────
export const requestsMetaTable = pgTable("requests_meta", {
  id:              serial("id").primaryKey(),
  agreementAddress:text("agreement_address").notNull(),
  onchainRequestId:integer("onchain_request_id").notNull(),
  requestType:     text("request_type").notNull(), // "milestone" | "adhoc"
  milestoneIndex:  integer("milestone_index"),
  reason:          text("reason"),
  evidenceUrl:     text("evidence_url"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
});

export const insertRequestMetaSchema = createInsertSchema(requestsMetaTable).omit({
  id: true,
  createdAt: true,
});

export type InsertRequestMeta = z.infer<typeof insertRequestMetaSchema>;
export type RequestMeta = typeof requestsMetaTable.$inferSelect;
