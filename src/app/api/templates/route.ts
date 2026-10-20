import {allowed} from "@/lib/permissions";
import {NextResponse} from "next/server";
import {getUser,getMembership} from "@/lib/auth";
import {getDatabase} from "@/lib/db";
export async function GET(){try{const user=await getUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});if(!allowed(await getMembership(user.id),"stocks_manage"))return NextResponse.json({error:"Product management access required"},{status:403});const {rows}=await getDatabase().query("SELECT id,product FROM erp_product_templates ORDER BY id");return NextResponse.json(rows,{headers:{"Cache-Control":"no-store"}})}catch{return NextResponse.json({error:"Unable to load templates"},{status:503})}}
