import { Router } from "express";
import {
  cancelTicket,
  createBet,
  getAllSorted,
  getLotteries,
  getTickets,
  runLotteryDraw,
} from "../controllers/bet.controller.js";
import { checkMetadata, winningFormat } from "../middlewares/bet.middleware.js";
import { critiqueRoute, privateRoute } from "../middlewares/auth.middleware.js";
const betRoutes = Router();

betRoutes.post(
  "/create",
  privateRoute,
  checkMetadata,
  createBet,
);
betRoutes.get("/tickets", privateRoute, getTickets);
betRoutes.put("/cancel/:id", privateRoute, cancelTicket);
betRoutes.post("/insert-sorted", privateRoute, winningFormat, runLotteryDraw);
betRoutes.get("/lotteries", privateRoute, getLotteries);

export default betRoutes;
