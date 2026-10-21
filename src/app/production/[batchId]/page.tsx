import {cookies} from "next/headers";
import {notFound,redirect} from "next/navigation";
import {getUser,getMembership} from "@/lib/auth";
import {allowed,landingPath} from "@/lib/permissions";
import ERP from "@/components/erp";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{batchId:string}>}){
 const {batchId}=await params;if(!/^PR-[A-Za-z0-9-]{1,80}$/.test(batchId))notFound();
 const user=await getUser();if(!user)redirect("/login");const access=await getMembership(user.id);if(!allowed(access,"production"))redirect(landingPath(access));const theme=(await cookies()).get("azad_theme")?.value;
 return <ERP key={`${access.workspace_id}:${access.role}:${[...access.permissions].sort().join(",")}`} batchId={batchId} brandingScope={`${access.workspace_id}:${user.email}`} access={{role:access.role,permissions:access.permissions}} initialTheme={theme==="light"?"light":"dark"} user={{name:user.name,email:user.email}}/>;
}
