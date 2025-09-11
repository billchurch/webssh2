import type { Application } from 'express';
import type { Server as HttpServer } from 'node:http';
export declare const createServer: (app: Application) => HttpServer;
import type { Config } from './types/config.js';
export declare const startServer: (server: HttpServer, config: Config) => void;
