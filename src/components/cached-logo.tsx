"use client";
import {useEffect,useState} from "react";
import Image from "next/image";
import {getLogoBlob} from "@/lib/branding-cache";

export default function CachedLogo({src,scope,width,height,className,alt=""}:{src:string;scope:string;width:number;height:number;className?:string;alt?:string}){
 const [loaded,setLoaded]=useState<{src:string;url:string;scope:string}|null>(null);
 useEffect(()=>{
  let active=true,objectUrl="";
  getLogoBlob(scope,src).then(blob=>{if(!active)return;objectUrl=URL.createObjectURL(blob);setLoaded({src,url:objectUrl,scope})}).catch(()=>{if(active)setLoaded({src,url:src,scope})});
  return ()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)};
 },[scope,src]);
 if(loaded?.src!==src||loaded?.scope!==scope)return <span aria-hidden="true" className={`${className??""} data-skeleton`} style={{display:"inline-block",width,height,flexShrink:0}}/>;
 return <Image unoptimized loading="eager" width={width} height={height} className={className} src={loaded.url} alt={alt}/>;
}
