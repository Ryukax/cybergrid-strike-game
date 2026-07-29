import { Router, type IRouter } from "express";
import healthRouter from "./health";
import blockchainRouter from "./blockchain.js";
import ecosystemRouter from "./ecosystem.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(blockchainRouter);
router.use(ecosystemRouter);

export default router;
