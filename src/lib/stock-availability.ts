import type {Bill,Entry,Product} from "./model";

const label=(text:string)=>text.replace(/\s+ft$/,"").trim();
function matches(product:Product,id:string|undefined,name:string|undefined){return id?id===product.id:!!name&&label(name)===`${product.type} · ${product.size}`}

// Always calculate from saved opening and dispatch records on the server.
// Stored totals or client-supplied availability never authorize a sale.
export function stockAvailability(product:Product,entries:Entry[],bills:Bill[]){
 if(product.type!=="Slab")return {availableStock:Math.max(0,product.stock),pendingStock:0,damagedStock:0,unconfirmedStock:0};
 const batches=entries.filter(e=>matches(product,e.productId,e.product));
 const pending=batches.filter(e=>!e.opening).reduce((n,e)=>n+e.quantity,0),good=batches.reduce((n,e)=>n+(e.opening?.good??0),0),damagedStock=batches.reduce((n,e)=>n+(e.opening?.damaged??0),0);
 const dispatched=bills.filter(b=>b.kind==="Gatepass").reduce((n,b)=>n+(b.items?b.items.reduce((q,r)=>q+(matches(product,r.productId,r.product)?r.quantity:0),0):matches(product,undefined,b.product)?b.quantity??0:0),0);
 const availableStock=Math.max(0,Math.min(product.stock-pending,good-dispatched));
 return {availableStock,pendingStock:Math.min(Math.max(0,product.stock),pending),damagedStock,unconfirmedStock:Math.max(0,product.stock-availableStock)};
}

// Until a fresh server response supplies availability, slabs stay unavailable.
export function sellableQuantity(product:Product){return product.type==="Slab"?product.availableStock??0:product.availableStock??product.stock}
