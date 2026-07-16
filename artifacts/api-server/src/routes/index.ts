import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agreementsRouter from "./agreements";
import requestsRouter from "./requests";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/agreements", agreementsRouter);
router.use("/agreements/:address/requests", requestsRouter);

export default router;
