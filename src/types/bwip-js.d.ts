// Minimal type declaration for bwip-js — the official package has no
// bundled types. We only use `toBuffer` in the app, so that's all we declare.
declare module 'bwip-js' {
  export interface BwipOptions {
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    width?: number;
    includetext?: boolean;
    textxalign?: 'left' | 'center' | 'right' | 'justify' | 'above' | 'below';
    textsize?: number;
    backgroundcolor?: string;
    [key: string]: unknown;
  }
  export function toBuffer(opts: BwipOptions, cb: (err: Error | null, png: Buffer) => void): void;
  export function toBuffer(opts: BwipOptions): Promise<Buffer>;
  const _default: {
    toBuffer: typeof toBuffer;
  };
  export default _default;
}
