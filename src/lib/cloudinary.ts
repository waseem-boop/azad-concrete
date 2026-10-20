import "server-only";
import {createHash,randomUUID} from "node:crypto";

export function cloudinaryConfig(){
 const value=process.env.CLOUDINARY_URL;if(!value)throw new Error("Logo uploads are not configured. Add CLOUDINARY_URL to the server environment.");
 const url=new URL(value);
 if(url.protocol!=="cloudinary:"||!url.username||!url.password||!/^[a-z0-9_-]+$/i.test(url.hostname))throw new Error("Cloudinary configuration is invalid.");
 return {cloud:url.hostname,key:decodeURIComponent(url.username),secret:decodeURIComponent(url.password)};
}
export function validFactoryLogo(logo:string,workspace:string){
 if(!logo)return true;
 // Keep existing saved logos compatible while new uploads use Cloudinary.
 if(logo.length<=400000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo))return true;
 if(logo.length>2048)return false;
 try{const url=new URL(logo),{cloud}=cloudinaryConfig();return url.protocol==="https:"&&url.hostname==="res.cloudinary.com"&&!url.username&&!url.password&&!url.port&&!url.search&&!url.hash&&url.pathname.startsWith(`/${cloud}/image/upload/`)&&new RegExp(`^/${cloud}/image/upload/v[0-9]+/azad-concrete/logos/${workspace}/[a-f0-9-]+\\.(webp|png|jpg|jpeg)$`).test(url.pathname)}catch{return false}
}
export function logoFileType(bytes:Buffer){
 if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return "image/png";
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return "image/jpeg";
 if(bytes.length>=12&&bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP")return "image/webp";
 return null;
}
export async function uploadFactoryLogo(file:File,workspace:string){
 const {cloud,key,secret}=cloudinaryConfig();
 const params:Record<string,string>={format:"webp",public_id:`azad-concrete/logos/${workspace}/${randomUUID()}`,timestamp:String(Math.floor(Date.now()/1000)),transformation:"c_limit,w_512,h_512"};
 const signature=createHash("sha1").update(Object.keys(params).sort().map(key=>`${key}=${params[key]}`).join("&")+secret).digest("hex"),form=new FormData();
 for(const [key,value] of Object.entries(params))form.set(key,value);
 form.set("file",file,"factory-logo");form.set("api_key",key);form.set("signature",signature);
 const response=await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`,{method:"POST",body:form,signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error(response.status===401||response.status===403?"Logo storage authentication failed. Check the Cloudinary credentials.":"Logo storage could not accept this image. Try another PNG, JPG or WebP.");
 const result=await response.json();
 if(typeof result.secure_url!=="string"||!validFactoryLogo(result.secure_url,workspace))throw new Error("Logo storage returned an invalid image address.");
 return result.secure_url as string;
}
