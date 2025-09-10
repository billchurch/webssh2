// Type declaration for jsmasker module
declare module 'jsmasker' {
  interface MaskOptions {
    properties?: string[];
    maskLength?: number;
    minLength?: number;
    maxLength?: number;
    maskChar?: string;
    fullMask?: boolean;
  }
  
  function maskObject(obj: Record<string, unknown>, options?: MaskOptions): Record<string, unknown>;
  export = maskObject;
}