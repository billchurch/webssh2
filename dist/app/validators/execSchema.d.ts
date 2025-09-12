export interface ExecPayload {
    command: string;
    pty?: boolean;
    term?: string;
    cols?: number;
    rows?: number;
    env?: Record<string, string>;
    timeoutMs?: number;
}
export type JSONSchema = {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: boolean;
};
export declare const execSchema: JSONSchema;
