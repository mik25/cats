const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '..', '..', 'log');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Define custom format
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
        return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
    })
);

// Create the logger
const logger = winston.createLogger({
    level: 'info',
    format: customFormat,
    transports: [
        // Console transport
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                customFormat
            )
        }),
        
        // Daily rotate file for general application logs
        new DailyRotateFile({
            filename: path.join(logsDir, 'application-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '3d',
            level: 'info'
        }),
        
        // Daily rotate file for exceptions
        new DailyRotateFile({
            filename: path.join(logsDir, 'exceptions-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
            level: 'error'
        })
    ],
    
    // Handle uncaught exceptions and unhandled rejections
    exceptionHandlers: [
        new winston.transports.Console(),
        new DailyRotateFile({
            filename: path.join(logsDir, 'exceptions-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d'
        })
    ],
    
    rejectionHandlers: [
        new winston.transports.Console(),
        new DailyRotateFile({
            filename: path.join(logsDir, 'exceptions-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d'
        })
    ]
});

// Create a function that supports both patterns:
// log('debug', 'message') and log.debug('message')
function log(level, message, ...args) {
    if (logger[level]) {
        logger[level](message, ...args);
    } else {
        logger.info(message, ...args);
    }
}

// Add methods for dot notation: log.debug(), log.info(), etc.
log.debug = (message, ...args) => logger.debug(message, ...args);
log.info = (message, ...args) => logger.info(message, ...args);
log.warn = (message, ...args) => logger.warn(message, ...args);
log.error = (message, ...args) => logger.error(message, ...args);
log.verbose = (message, ...args) => logger.verbose(message, ...args);
log.silly = (message, ...args) => logger.silly(message, ...args);

module.exports = log;