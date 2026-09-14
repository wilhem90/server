import { rateLimit } from "express-rate-limit";

// Vamos retornar uma mensagem mais clara quando o limite for atingido
const limiter = (time, limit) =>
  rateLimit({
    windowMs: time,
    limit,
    standardHeaders: "draft-8",
    ipv6Subnet: 56,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: "Too many requests, please try again later.",
      });
    },
  });

  
export default limiter;
