import express from "express";
import controllerNotify from "../controllers/notify.controller.js";
const router = express.Router();

// Define your notification routes here
router.get("/get-notification", controllerNotify.getNotification);

export default router;
