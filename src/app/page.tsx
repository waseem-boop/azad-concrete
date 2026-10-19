import {redirect} from "next/navigation";
import {getUser} from "@/lib/auth";
import ERP from "@/components/erp";
export const dynamic="force-dynamic";
export default async function Page(){const user=await getUser();if(!user)redirect("/login");return <ERP user={{name:user.name,email:user.email}}/>}
