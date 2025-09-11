import { describe, it, expect, vi } from 'vitest';
import { WebSSH2Error, ConfigError, SSHConnectionError, handleError } from '../app/errors.js';
describe('errors.ts', () => {
    it('derives WebSSH2Error correctly', () => {
        const e = new WebSSH2Error('oops', 'E_CODE');
        expect(e.code).toBe('E_CODE');
    });
    it('specialized errors set codes', () => {
        expect(new ConfigError('x').code).toBeDefined();
        expect(new SSHConnectionError('x').code).toBeDefined();
    });
    it('handleError writes to response', () => {
        const status = vi.fn().mockReturnValue({ json: vi.fn() });
        handleError(new ConfigError('bad'), { status });
        expect(status).toHaveBeenCalled();
    });
});
