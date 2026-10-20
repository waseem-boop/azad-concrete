"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {usePathname,useRouter} from "next/navigation";
import type {State,FactorySettings} from "./model";
import type {Access} from "./permissions";
import {readWorkspaceCache,saveWorkspaceCache,removeWorkspaceCache,workspaceCacheKey,permissionKey,type WorkspaceData,type CachedWorkspace} from "./workspace-cache";

export function useWorkspace({scope,access,onState}:{scope:string;access:Access;onState:(s:State)=>void}){
 const router=useRouter(),pathname=usePathname(),key=workspaceCacheKey(scope,access),rights=permissionKey(access),workspaceId=scope.split(":")[0];
 const [hasData,setHasData]=useState(false),[ready,setReady]=useState(false),[syncing,setSyncing]=useState(false),[error,setError]=useState("");
 const record=useRef<CachedWorkspace|null>(null),epoch=useRef(0),inflight=useRef<Promise<void>|null>(null),controller=useRef<AbortController|null>(null),mutating=useRef(false),channel=useRef<BroadcastChannel|null>(null);
 const cancelRefresh=useCallback(()=>{epoch.current++;controller.current?.abort();controller.current=null;inflight.current=null},[]);
 const accept=useCallback((data:WorkspaceData)=>data.workspaceId===workspaceId&&permissionKey(data.access)===rights,[workspaceId,rights]);
 const discard=useCallback(()=>{record.current=null;setHasData(false);setReady(false);void removeWorkspaceCache(key)},[key]);
 const store=useCallback((next:CachedWorkspace)=>{record.current=next;onState(next.data);setHasData(true);void saveWorkspaceCache(key,next)},[key,onState]);
 const refresh=useCallback(async()=>{
  if(mutating.current)return;if(inflight.current)return inflight.current;
  const generation=epoch.current;const abort=new AbortController();controller.current=abort;setSyncing(true);
  const task=(async()=>{try{
   const cached=record.current??await readWorkspaceCache(key);if(generation!==epoch.current||abort.signal.aborted)return;if(!record.current&&cached&&accept(cached.data))store(cached);const current=record.current;const response=await fetch("/api/erp",{cache:"no-store",headers:current?.etag?{"If-None-Match":current.etag}:{},signal:abort.signal});
   if(generation!==epoch.current)return;
   if(response.status===401){discard();router.replace("/login");router.refresh();return}
   if(response.status===304&&record.current){const checked={...record.current,savedAt:Date.now()};record.current=checked;void saveWorkspaceCache(key,checked);setReady(true);setError("");return}
   const data=await response.json();if(generation!==epoch.current)return;if(!response.ok)throw new Error(data.error||"Unable to refresh factory data");
   if(!accept(data)){discard();router.refresh();return}
   store({data,etag:response.headers.get("etag")??"",savedAt:Date.now()});setReady(true);setError("");
  }catch(e){if(!abort.signal.aborted&&generation===epoch.current){setError(e instanceof Error?e.message:"Unable to refresh factory data");setReady(false)}}finally{if(controller.current===abort){inflight.current=null;setSyncing(false)}}})();
  inflight.current=task;await task;
 },[accept,discard,key,router,store]);
 useEffect(()=>{
  let active=true;
  void readWorkspaceCache(key).then(cached=>{if(active&&cached&&!record.current&&accept(cached.data))store(cached)});
  void Promise.resolve().then(()=>{if(active)return refresh()});
  const check=()=>{if(document.visibilityState==="visible")void refresh()};
  window.addEventListener("focus",check);window.addEventListener("online",check);document.addEventListener("visibilitychange",check);
  const timer=setInterval(check,30000);
  if(typeof BroadcastChannel!=="undefined"){const bus=new BroadcastChannel("azad-workspace-updates");channel.current=bus;bus.onmessage=event=>{if(event.data?.scope===scope)void refresh()}}
  return ()=>{active=false;cancelRefresh();clearInterval(timer);window.removeEventListener("focus",check);window.removeEventListener("online",check);document.removeEventListener("visibilitychange",check);channel.current?.close();channel.current=null};
 },[accept,cancelRefresh,key,refresh,scope,store]);
 useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(active)return refresh()});return ()=>{active=false}},[pathname,refresh]);
 async function mutate(action:string,payload:Record<string,unknown>){
  if(mutating.current)throw new Error("A record is already being saved");
  mutating.current=true;const generation=++epoch.current;controller.current?.abort();controller.current=null;inflight.current=null;setSyncing(false);
  try{
   const response=await fetch("/api/erp",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,payload})}),data=await response.json();
   if(response.status===401){discard();router.replace("/login");router.refresh();throw new Error("Sign in required")}
   if(response.status===403){discard();router.refresh()}
   if(!response.ok)throw new Error(data.error||"Unable to save record");
   if(generation!==epoch.current)return true;
   if(!accept(data)){discard();router.refresh();throw new Error("Your factory access changed. Please try again.")}
   store({data,etag:response.headers.get("etag")??"",savedAt:Date.now()});setReady(true);setError("");channel.current?.postMessage({scope});return true;
  }finally{mutating.current=false}
 }
 function patchSettings(patch:Partial<FactorySettings>){
  const current=record.current;if(!current?.data.settings)return;
  epoch.current++;controller.current?.abort();controller.current=null;inflight.current=null;setSyncing(false);
  store({...current,data:{...current.data,settings:{...current.data.settings,...patch}},etag:"",savedAt:Date.now()});channel.current?.postMessage({scope});void refresh();
 }
 return {hasData,ready,syncing,error,refresh,mutate,patchSettings,cancelRefresh};
}
