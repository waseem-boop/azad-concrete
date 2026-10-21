import type {State} from "./model";
import {allowed,type Access} from "./permissions";
import {invoiceSettlements} from "./invoice-settlement";
import {stockAvailability} from "./stock-availability";
// Explicit fields prevent accidentally exposing new private fields.
export function visibleState(s:State,a:Access&{workspace_id?:string}):State & {access:Access;workspaceId?:string}{
 const can=(p:Parameters<typeof allowed>[1])=>allowed(a,p),finance=can("accounts_view"),settlements=finance||can("gatepass_view")?invoiceSettlements(s.bills):new Map();
 return {
  access:{role:a.role,permissions:a.permissions},workspaceId:a.workspace_id,settings:s.settings,
  stock:can("dashboard")||can("stocks_view")?s.stock.map(p=>({id:p.id,size:p.size,type:p.type,stock:p.stock,length:p.length,width:p.width,height:p.height,confirmed:p.confirmed,salePrice:p.salePrice,inventoryValue:finance?p.inventoryValue:undefined,...stockAvailability(p,s.entries,s.bills)})):[],
  materials:can("dashboard")||can("materials_view")?s.materials.map(m=>({name:m.name,detail:m.detail,unit:m.unit,stock:m.stock,capacity:m.capacity,color:m.color,quantities:m.quantities,purchaseRate:finance||can("materials_manage")?m.purchaseRate:undefined,inventoryValue:finance?m.inventoryValue:undefined})):[],
  materialReceipts:can("materials_view")?(s.materialReceipts??[]).map(r=>({...r,rate:finance||can("materials_manage")?r.rate:0,amount:finance||can("materials_manage")?r.amount:0,account:finance||can("materials_manage")?r.account:undefined})):[],
  entries:can("dashboard")||can("production")?s.entries.map(e=>({id:e.id,product:e.product,productId:e.productId,quantity:e.quantity,date:e.date,materialCost:finance?e.materialCost:undefined,opening:e.opening?{...e.opening,writtenOffValue:finance?e.opening.writtenOffValue:undefined}:undefined})):[],
  bills:s.bills.filter(b=>finance||(b.kind==="Gatepass"&&can("gatepass_view"))||(b.kind==="Expense"&&can("expenses_view"))).map(b=>{const {requestHash:privateHash,requestId:privateId,...record}=b;void privateHash;void privateId;return b.kind==="Gatepass"?{...record,settlement:settlements.get(b.id)}:record}),
  customers:finance||can("gatepass_view")?s.customers??[]:[],journals:finance?s.journals??[]:[],
  assets:can("assets_view")?s.assets??[]:[],openingBalances:finance?s.openingBalances??[]:[]
 }
}
