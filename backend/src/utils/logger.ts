import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // Console output
    new winston.transports.Console({
      format: combine(colorize(), logFormat)
    }),
    // File output for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    // File output for all logs
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

export default logger;
