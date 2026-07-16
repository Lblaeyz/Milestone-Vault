import { Router } from "express";
import { db, agreementsTable, insertAgreementSchema } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// GET /agreements — list all, optionally filtered by investor or builder
router.get("/", async (req, res) => {
  const { investor, builder } = req.query as Record<string, string | undefined>;
  try {
    let rows = await db.select().from(agreementsTable).orderBy(agreementsTable.createdAt);
    if (investor) rows = rows.filter((r) => r.investorAddress.toLowerCase() === investor.toLowerCase());
    if (builder)  rows = rows.filter((r) => r.builderAddress.toLowerCase()  === builder.toLowerCase());
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list agreements");
    res.status(500).json({ error: "Failed to fetch agreements" });
  }
});

// GET /agreements/all/disputed — all agreements (arbiter panel fetches on-chain dispute state)
router.get("/all/disputed", async (req, res) => {
  try {
    const rows = await db.select().from(agreementsTable).orderBy(agreementsTable.createdAt);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list disputes");
    res.status(500).json({ error: "Failed to fetch agreements" });
  }
});

// GET /agreements/:address
router.get("/:address", async (req, res) => {
  const address = req.params["address"]!.toLowerCase();
  try {
    const [row] = await db.select().from(agreementsTable).where(eq(agreementsTable.contractAddress, address));
    if (!row) {
      res.status(404).json({ error: "Agreement not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to get agreement");
    res.status(500).json({ error: "Failed to fetch agreement" });
  }
});

// POST /agreements
router.post("/", async (req, res) => {
  const parsed = insertAgreementSchema.safeParse({
    ...req.body,
    contractAddress: req.body.contractAddress?.toLowerCase(),
    investorAddress: req.body.investorAddress?.toLowerCase(),
    builderAddress:  req.body.builderAddress?.toLowerCase(),
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    return;
  }

  try {
    const [row] = await db.insert(agreementsTable).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to create agreement");
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505") {
      res.status(409).json({ error: "Agreement already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to create agreement" });
  }
});

export default router;
