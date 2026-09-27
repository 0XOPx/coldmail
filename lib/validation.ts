export const MAX_SUBJECT=300;
export const MAX_BODY=500_000;
export const MAX_RECIPIENTS=100;
const address=/^[^\s@]+@coldmail\.com$/i;
export function validAddress(v:string){return address.test(v)}
export function normalizeAddresses(values:unknown){if(!Array.isArray(values))return [];return [...new Set(values.map(v=>String(v).trim().toLowerCase()).filter(validAddress))]}
export function safeFilename(name:string){return name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,180)||"attachment"}
