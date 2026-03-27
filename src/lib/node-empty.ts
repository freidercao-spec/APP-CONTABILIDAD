export const spawn = () => ({ on: () => {} });
export const createReadStream = () => ({ on: () => {} });
export const randomUUID = () => Math.random().toString(36).substring(2);
export const randomFillSync = (buf: any) => buf;
export const createHash = () => ({ update: () => ({ digest: () => '' }) });
export const Readable = class {};
export const Writable = class {};
export const Transform = class {};
export default { 
    spawn, 
    createReadStream, 
    randomUUID, 
    randomFillSync, 
    createHash,
    Readable,
    Writable,
    Transform
};
