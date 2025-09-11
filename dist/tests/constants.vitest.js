import { describe, it, expect } from 'vitest';
import { MESSAGES, DEFAULTS, HTTP } from '../app/constants.js';
describe('constants.ts', () => {
    it('has expected defaults', () => {
        expect(DEFAULTS.SSH_PORT).toBe(22);
        expect(DEFAULTS.LISTEN_PORT).toBe(2222);
        expect(DEFAULTS.IO_PATH).toBe('/ssh/socket.io');
    });
    it('exposes messages and HTTP enums', () => {
        expect(MESSAGES.UNEXPECTED_ERROR).toBeTypeOf('string');
        expect(HTTP.OK).toBe(200);
    });
});
