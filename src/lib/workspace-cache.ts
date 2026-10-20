import type {State} from "./model";
import type {Access} from "./permissions";
export type WorkspaceData=State&{access:Access;workspaceId:string};
export type CachedWorkspace={data:WorkspaceData;etag:string;savedAt:number};
const name="azad-workspace-v2",memory=new Map<string,CachedWorkspace>(),writes=new Map<string,Promise<void>>();let generation=0;
export function permissionKey(access:Access){return `${access.role}:${[...access.permissions].sort().join(",")}`}
export function workspaceCacheKey(scope:string,access:Access){return `${scope}:${permissionKey(access)}`}
function url(key:string){return `${location.origin}/__azad_local_data__/${encodeURIComponent(key)}`}
function valid(value:unknown):value is CachedWorkspace{const c=value as CachedWorkspace;return !!c&&typeof c.etag==="string"&&typeof c.savedAt==="number"&&Date.now()-c.savedAt<86400000&&!!c.data?.access&&typeof c.data.workspaceId==="string"&&[c.data.stock,c.data.materials,c.data.entries,c.data.bills].every(Array.isArray)}
export async function readWorkspaceCache(key:string):Promise<CachedWorkspace|null>{
 const existing=memory.get(key);if(valid(existing))return existing;
 try{const cache=await caches.open(name),response=await cache.match(url(key));if(!response)return null;const record=await response.json();if(valid(record)){memory.set(key,record);return record}await cache.delete(url(key))}catch{}
 return null;
}
export async function saveWorkspaceCache(key:string,record:CachedWorkspace){
 memory.set(key,record);const current=generation;
 const task=(writes.get(key)??Promise.resolve()).catch(()=>{}).then(async()=>{if(current!==generation)return;try{const cache=await caches.open(name);await cache.put(url(key),new Response(JSON.stringify(record),{headers:{"Content-Type":"application/json"}}))}catch{}});
 writes.set(key,task);await task;if(writes.get(key)===task)writes.delete(key);
}
export async function removeWorkspaceCache(key:string){memory.delete(key);await writes.get(key);try{const cache=await caches.open(name);await cache.delete(url(key))}catch{}}
export async function clearWorkspaceCache(){generation++;memory.clear();await Promise.allSettled([...writes.values()]);writes.clear();try{await Promise.all([caches.delete(name),caches.delete("azad-workspace-v1")])}catch{}}
