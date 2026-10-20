import type {FactorySettings} from "./model";

type Branding=Pick<FactorySettings,"name"|"logo">;
const prefix="azad-branding-v1:";
const pending=new Map<string,Promise<Blob>>();
export function readBranding(scope:string):Branding|null{
 try{const value=JSON.parse(localStorage.getItem(prefix+scope)??"null");return value&&typeof value.name==="string"&&typeof value.logo==="string"?{name:value.name,logo:value.logo}:null}catch{return null}
}
export function saveBranding(scope:string,settings:Branding){
 try{localStorage.setItem(prefix+scope,JSON.stringify({name:settings.name,logo:settings.logo}))}catch{}
}
async function logoCache(scope:string){try{return await caches.open(prefix+scope)}catch{return null}}
export async function rememberLogo(scope:string,src:string,blob:Blob){
 if(!src.startsWith("https://")||!blob.type.startsWith("image/"))return;
 const cache=await logoCache(scope);if(!cache)return;
 try{await cache.put(src,new Response(blob,{headers:{"Content-Type":blob.type}}));for(const request of await cache.keys())if(request.url!==src)await cache.delete(request)}catch{/* Private browsing or full storage falls back to the browser image cache. */}
}
export function getLogoBlob(scope:string,src:string):Promise<Blob>{
 const key=scope+":"+src,existing=pending.get(key);if(existing)return existing;
 const request=(async()=>{
  const cache=await logoCache(scope);
  try{const response=await cache?.match(src);if(response){const blob=await response.blob();if(blob.size&&blob.type.startsWith("image/"))return blob;await cache?.delete(src)}}catch{}
  const response=await fetch(src,{cache:"force-cache",credentials:"omit",signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error("Logo could not be loaded");
  const blob=await response.blob();if(!blob.size||!blob.type.startsWith("image/"))throw new Error("Invalid logo image");
  await rememberLogo(scope,src,blob);return blob;
 })();
 pending.set(key,request);void request.finally(()=>pending.delete(key)).catch(()=>{});return request;
}
