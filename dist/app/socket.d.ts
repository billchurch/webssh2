import type { Server as SocketIOServer } from 'socket.io';
import type { Config } from './types/config.js';
import type { ClientToServerEvents as C2S, ServerToClientEvents as S2C, InterServerEvents as IS, SocketData as SD } from './types/contracts/v1/socket.js';
export default function init(io: SocketIOServer<C2S, S2C, IS, SD>, config: Config, SSHConnectionClass: new (config: Config) => unknown): void;
