import {allowed,sectionPermission,landingPath} from "@/lib/permissions";
import {cookies} from "next/headers";
import {redirect,notFound} from "next/navigation";
import {getUser,getMembership} from "@/lib/auth";
import ERP from "@/components/erp";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!["employees","dashboard","stocks","raw-material","gatepass","accounts","customers","expenses","assets","settings","team","production"].includes(section))notFound();const user=await getUser();if(!user)redirect("/login");const access=await getMembership(user.id);if(section!=="team"&&!allowed(access,sectionPermission[section]))redirect(landingPath(access));const theme=(await cookies()).get("azad_theme")?.value;return <ERP key={`${access.workspace_id}:${access.role}:${[...access.permissions].sort().join(",")}`} brandingScope={`${access.workspace_id}:${user.email}`} access={{role:access.role,permissions:access.permissions}} initialTheme={theme==="light"?"light":"dark"} user={{name:user.name,email:user.email}}/>}
