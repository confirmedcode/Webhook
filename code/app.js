// Load environment
require("./config/environment.js");

// Shared
const ConfirmedError = require("shared/error");
const Logger = require("shared/logger");

// Constants
const DOMAIN = process.env.DOMAIN;
const STRIPE_PUBLIC_KEY = process.env.STRIPE_PUBLIC_KEY;
const NODE_ENV = process.env.NODE_ENV;
const ENVIRONMENT = process.env.ENVIRONMENT;

// Express and body parsers
const express = require("express");
const app = express();

// Log errors
const expressWinston = require("express-winston");
expressWinston.requestWhitelist = ["url", "method", "httpVersion", "originalUrl"];
app.use(expressWinston.logger({
  winstonInstance: Logger,
  skip: function (request, response) {
    if (response.statusCode < 400) {
      return true;
    }
    return false;
  }
}));

// Log unhandled rejections
process.on("unhandledRejection", error => {
  Logger.error(`unhandledRejection:
    ${error.stack}`);
});

// Controllers
app.use("/", require("./controllers/webhook-controller.js"));

app.get("/error-test", (request, response, next) => {
  next(new ConfirmedError(500, 999, "Test alerts", "Details here"));
});

app.get("/health", (request, response, next) => {
  response.status(200).json({
    message: "OK from " + DOMAIN
  });
});

// Log Errors
app.use(expressWinston.errorLogger({
  winstonInstance: Logger
}));

// Handle Errors
app.use((error, request, response, next) => {
  if (response.headersSent) {
    Logger.error("RESPONSE ALREADY SENT");
    return;
  }
  if (error.statusCode < 200) {
    error.statusCode = 500;
  }
  response.status(500).json({
    code: error.confirmedCode,
    message: error.message
  });
});

// Handle 404 Not Found
app.use((request, response, next) => {
  Logger.error("404 NOT FOUND - " + request.originalUrl);
  response.status(404).json({
    code: 404,
    message: "Not Found"
  });
});

module.exports = app;