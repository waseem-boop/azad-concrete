import type {Entry,JournalLine,Product,State} from "./model";
import {money} from "./finance";

export function productionDay(date:string){return new Date(date).toLocaleDateString("en-CA",{timeZone:"Asia/Karachi"})}
export function batchProduct(entry:Entry,stock:Product[]){return entry.productId?stock.find(p=>p.id===entry.productId):stock.find(p=>entry.product===`${p.type} · ${p.size}${p.type==="Slab"?" ft":""}`)}
export function isSlabBatch(entry:Entry){return entry.product.startsWith("Slab · ")}
export function openingDueDay(entry:Entry){const date=new Date(`${productionDay(entry.date)}T00:00:00Z`);date.setUTCDate(date.getUTCDate()+3);return date.toISOString().slice(0,10)}

export function recordProductionOpening(s:State,p:Record<string,unknown>,recordedBy:string,post:(description:string,reference:string,lines:JournalLine[])=>void,now=new Date()){
 const entry=s.entries.find(e=>e.id===p.batchId);if(!entry)throw new Error("Production batch not found");
 const product=batchProduct(entry,s.stock);if(!product||product.type!=="Slab"||!isSlabBatch(entry))throw new Error("Select a slab production batch");
 const date=typeof p.date==="string"?p.date:"",good=p.good,damaged=p.damaged,note=typeof p.note==="string"?p.note.trim():"";
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date)throw new Error("Select a valid opening date");
 if(date<productionDay(entry.date)||date>productionDay(now.toISOString()))throw new Error("Opening date must be between the production date and today");
 if(typeof good!=="number"||typeof damaged!=="number"||!Number.isInteger(good)||!Number.isInteger(damaged)||good<0||damaged<0||good+damaged!==entry.quantity)throw new Error(`Good and damaged slabs must total ${entry.quantity} produced pieces`);
 if(note.length>500)throw new Error("Use a note under 500 characters");
 if(entry.opening){if(entry.opening.date===date&&entry.opening.good===good&&entry.opening.damaged===damaged&&entry.opening.note===note)return;throw new Error("Opening results are already recorded for this batch. They cannot be overwritten")}
 if(damaged>product.stock)throw new Error(`Only ${product.stock} slabs of this size remain in stock. ${damaged} damaged slabs cannot be deducted; review previous dispatches before saving`);
 const writtenOffValue=product.stock>0?money((product.inventoryValue??0)*damaged/product.stock):0;
 product.stock-=damaged;product.inventoryValue=money(Math.max(0,(product.inventoryValue??0)-writtenOffValue));
 entry.opening={date,good,damaged,note,recordedAt:now.toISOString(),recordedBy,writtenOffValue};
 if(writtenOffValue>0)post(`Damaged slabs: ${product.size} · ${entry.id}`,`OP-${entry.id}`,[{account:"Operating expenses",debit:writtenOffValue,credit:0},{account:"Finished goods inventory",debit:0,credit:writtenOffValue}]);
}
