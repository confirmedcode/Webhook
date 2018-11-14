const Logger = require("shared/logger");

// Load environment variables
require("shared/environment")([
  "COMMON",
  "WEBHOOK"
]);

// Load database login
process.env.PG_USER = "webhook";
process.env.PG_PASSWORD = process.env.PG_WEBHOOK_PASSWORD;