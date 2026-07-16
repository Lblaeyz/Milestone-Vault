import { Router } from "express";
import { db, requestsMetaTable, insertRequestMetaSchema } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router({ mergeParams: true });

// GET /agreements/:address/requests
router.get("/", async (req, res) => {
  const address = (req.params as Record<string, string>).address.toLowerCase();
  try {
    const rows = await db
      .select()
      .from(requestsMetaTable)
      .where(eq(requestsMetaTable.agreementAddress, address))
      .orderBy(asc(requestsMetaTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list requests");
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

// POST /agreements/:address/requests
router.post("/", async (req, res) => {
  const address = (req.params as Record<string, string>).address.toLowerCase();
  const parsed = insertRequestMetaSchema.safeParse({
    ...req.body,
    agreementAddress: address,
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    return;
  }

  try {
    const [row] = await db.insert(requestsMetaTable).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to create request meta");
    res.status(500).json({ error: "Failed to create request" });
  }
});

export default router;
