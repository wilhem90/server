import { rateLimit } from "express-rate-limit";

const limiter = (time, limit) =>
  rateLimit({
    windowMs: time,
    limit,
    standardHeaders: "draft-8",
    ipv6Subnet: 56,
  });

export default limiter;