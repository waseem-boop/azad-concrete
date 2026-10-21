import {createHash,randomUUID} from "node:crypto";
import type {BillItem,JournalLine,State} from "./model";
import {materialUnits,money,unitFactor} from "./finance";
import {validateGatepassPayment} from "./invoice-settlement";
import {stockAvailability} from "./stock-availability";
export class ReceiptPermissionError extends Error{}

type Post=(description:string,reference:string|undefined,lines:JournalLine[])=>void;
function number(value:unknown,label:string,integer=false,zero=false){
 if(typeof value!=="number"||!Number.isFinite(value)||value>(1e9)||value<(zero?0:Number.MIN_VALUE)||(integer&&!Number.isInteger(value)))throw new Error(`Enter a valid ${label}`);
 return value;
}
function text(value:unknown,max:number){return typeof value==="string"?value.trim().slice(0,max+1):""}

export function recordMaterial(s:State,p:Record<string,unknown>,post:Post,spend:(account:string,amount:number)=>void){
 const m=s.materials.find(m=>m.name===p.product);if(!m)throw new Error("Select a material");
 const unit=String(p.unit??m.unit);if(!materialUnits(m).includes(unit))throw new Error("Choose a valid receipt unit");
 const quantity=number(p.quantity,"quantity",unit==="trali"),rate=money(number(p.rate??0,"purchase rate",false,true)),amount=money(quantity*rate);
 if(amount>1e9)throw new Error("Receipt total is too large");
 const capacitySqft=unit==="trali"?number(p.capacitySqft,"trali size in square feet"):undefined;
 const note=text(p.note,300);if(note.length>300)throw new Error("Use a note under 300 characters");
 const account=amount>0?String(p.account):undefined;if(account&&!["Cash","Bank","Accounts payable"].includes(account))throw new Error("Choose Cash, Bank or Accounts payable");
 const id=`MR-${randomUUID().slice(0,8).toUpperCase()}`;
 if(account){if(account!=="Accounts payable")spend(account,amount);post(`Material receipt: ${m.name} · ${quantity} ${unit}`,id,[{account:"Raw material inventory",debit:amount,credit:0},{account,debit:0,credit:amount}])}
 // Historical cft totals stay cft. Never infer weight from volume or area.
 const compatible=unit===m.unit||(m.name==="Cement"&&unit==="kg"&&m.unit==="bags")||(m.name==="Saria"&&unit==="tonne"&&m.unit==="kg");
 if(compatible){m.stock=Number((m.stock+quantity*unitFactor(m,unit)).toFixed(4))}else{m.quantities??={};m.quantities[unit]=Number(((m.quantities[unit]??0)+quantity).toFixed(4))}
 m.inventoryValue=money((m.inventoryValue??0)+amount);
 // Mixed units have no meaningful common per-unit rate.
 m.purchaseRate=!Object.keys(m.quantities??{}).length&&m.stock>0?m.inventoryValue/m.stock:undefined;
 s.materialReceipts??=[];s.materialReceipts.unshift({id,date:new Date().toISOString(),material:m.name,quantity,unit,capacitySqft,rate,amount,account,note});
}

export function recordGatepass(s:State,p:Record<string,unknown>,post:Post,canReceive=true){
 const requestId=p.requestId;if(requestId!==undefined&&(typeof requestId!=="string"||!/^[0-9a-f-]{36}$/i.test(requestId)))throw new Error("Invalid invoice request. Reopen the form");
 const requestHash=requestId?createHash("sha256").update(JSON.stringify(p)).digest("hex"):undefined;
 const previous=requestId?s.bills.find(b=>b.kind==="Gatepass"&&b.requestId===requestId):undefined;if(previous){if(previous.requestHash!==requestHash)throw new Error("This invoice was already saved. Reopen the form for another sale");return}
 const customerType=p.customerType??"dealer";if(customerType!=="dealer"&&customerType!=="walk-in")throw new Error("Choose Dealer or Walk-in customer");
 const rows=p.items??[{product:p.product,quantity:p.quantity,rate:p.rate}];
 if(!Array.isArray(rows)||rows.length<1||rows.length>50)throw new Error("Add between 1 and 50 products");
 const required=new Map<string,number>();
 const items:BillItem[]=rows.map(row=>{
  if(!row||typeof row!=="object")throw new Error("Invalid invoice product");
  const product=s.stock.find(x=>x.id===row.product);if(!product)throw new Error("Select a product for every row");
  const quantity=number(row.quantity,"whole-number quantity",true),rate=money(number(row.rate,"unit sale price"));if(rate<=0)throw new Error("Unit price must be at least Rs. 0.01");
  const amount=money(quantity*rate);required.set(product.id,(required.get(product.id)??0)+quantity);
  return {productId:product.id,product:`${product.type} · ${product.size}${product.type==="Slab"?" ft":""}`,quantity,rate,amount};
 });
 for(const [id,quantity] of required){const product=s.stock.find(p=>p.id===id)!,availability=stockAvailability(product,s.entries,s.bills);if(quantity>availability.availableStock)throw new Error(product.type==="Slab"?`Only ${availability.availableStock} opened, good slabs of ${product.size} are available for sale. Confirm pending slab openings before selling more`:`Not enough finished stock: ${product.size} (${availability.availableStock} available)`)}
 const subtotal=money(items.reduce((n,r)=>n+r.amount,0));if(subtotal>1e9)throw new Error("Invoice total is too large");
 const discountPercent=p.discountPercent===undefined?undefined:number(p.discountPercent,"discount percentage",false,true);
 if(discountPercent!==undefined&&(discountPercent>100||money(discountPercent)!==discountPercent))throw new Error("Discount must be between 0% and 100%, with at most two decimal places");
 const discount=discountPercent===undefined?money(number(p.discount??0,"discount",false,true)):money(subtotal*discountPercent/100);
 if(discountPercent!==undefined&&p.discount!==undefined&&money(number(p.discount,"discount",false,true))!==discount)throw new Error("Discount amount does not match its percentage");
 if(customerType==="walk-in"&&(discount!==0||(discountPercent??0)!==0))throw new Error("Discount is only available for dealers");if(discount>subtotal)throw new Error("Discount cannot exceed the subtotal");
 const amount=money(subtotal-discount),payment=validateGatepassPayment(p.payment,amount);
 if(payment.cash+payment.bank>0&&!canReceive)throw new ReceiptPermissionError("You need Customers & receipts permission to collect payment. You can create an unpaid gatepass");
 s.customers??=[];let customer=s.customers.find(c=>c.id===p.customerId);
 if(customerType==="dealer"){if(!customer||(customer.kind??"dealer")!=="dealer")throw new Error("Select a dealer from the customer register")}
 else if(customer){if(customer.kind!=="walk-in")throw new Error("Select a walk-in customer")}
 else {if(p.customerId)throw new Error("Customer not found");const name=text(p.name,120),phone=text(p.phone,40);if(name.length<2||name.length>120||phone.length>40)throw new Error("Enter a walk-in customer name (2–120 characters). Phone is optional");customer={id:randomUUID(),name,phone,kind:"walk-in"};s.customers.push(customer)}
 const id=`GP-${randomUUID().slice(0,8).toUpperCase()}`,date=new Date().toISOString();
 for(const [productId,quantity] of required){const product=s.stock.find(p=>p.id===productId)!;const cost=product.stock>0?money((product.inventoryValue??0)*quantity/product.stock):0;product.stock-=quantity;product.inventoryValue=money(Math.max(0,(product.inventoryValue??0)-cost));if(cost>0)post(`Cost of dispatch: ${product.size}`,id,[{account:"Cost of goods sold",debit:cost,credit:0},{account:"Finished goods inventory",debit:0,credit:cost}])}
 s.bills.unshift({id,kind:"Gatepass",name:customer!.name,phone:customer!.phone,customerId:customer!.id,customerType,items,subtotal,discount,discountPercent,amount,date,product:items.map(r=>r.product).join("; "),quantity:items.reduce((n,r)=>n+r.quantity,0),rate:items.length===1?items[0].rate:undefined,initialPayment:payment,requestId:requestId as string|undefined,requestHash});
 if(amount>0)post(`Gatepass: ${customer!.name}`,id,[{account:"Accounts receivable",debit:amount,credit:0},{account:"Sales",debit:0,credit:amount}]);
 for(const [account,received] of [["Cash",payment.cash],["Bank",payment.bank]] as const){if(received<=0)continue;const receiptId=`PM-${randomUUID().slice(0,8).toUpperCase()}`;s.bills.unshift({id:receiptId,kind:"Payment",name:customer!.name,customerId:customer!.id,invoiceId:id,amount:received,quantity:1,rate:received,date,paymentAccount:account});post(`Payment: ${customer!.name} · ${id}`,receiptId,[{account,debit:received,credit:0},{account:"Accounts receivable",debit:0,credit:received}])}
}
