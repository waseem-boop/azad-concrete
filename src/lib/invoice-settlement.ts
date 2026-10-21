import type {Bill,InvoiceSettlement} from "./model";
const cents=(n:number)=>Math.round(n*100);
export const paymentStatusLabel={unpaid:"Unpaid",partial:"Partially paid",paid:"Fully paid"};

// Explicit invoice receipts settle their own invoice. Older/customer-wide receipts
// settle the oldest remaining invoices; surplus stays as customer credit.
export function invoiceSettlements(bills:Bill[]):Map<string,InvoiceSettlement>{
 const invoices=bills.slice().reverse().filter(b=>b.kind==="Gatepass").sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const amounts=new Map(invoices.map(b=>[b.id,{total:cents(b.amount),cash:0,bank:0,other:0}]));
 const payments=bills.slice().reverse().filter(b=>b.kind==="Payment").sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 function apply(payment:Bill,invoice:Bill,left:number){const record=amounts.get(invoice.id)!;const paid=record.cash+record.bank+record.other,allocated=Math.max(0,Math.min(left,record.total-paid));const account=payment.paymentAccount==="Cash"?"cash":payment.paymentAccount==="Bank"?"bank":"other";record[account]+=allocated;return left-allocated}
 for(const payment of payments.filter(p=>p.invoiceId)){const invoice=invoices.find(b=>b.id===payment.invoiceId&&b.customerId===payment.customerId);if(invoice)apply(payment,invoice,cents(payment.amount))}
 for(const payment of payments.filter(p=>!p.invoiceId)){if(!payment.customerId)continue;let left=cents(payment.amount);for(const invoice of invoices){if(invoice.customerId===payment.customerId)left=apply(payment,invoice,left);if(left<=0)break}}
 return new Map([...amounts].map(([id,r])=>{const received=r.cash+r.bank+r.other,remaining=Math.max(0,r.total-received);return [id,{cash:r.cash/100,bank:r.bank/100,other:r.other/100,received:received/100,remaining:remaining/100,status:remaining===0?"paid":received>0?"partial":"unpaid"}]}));
}
export function settlementFor(bill:Bill):InvoiceSettlement{return bill.settlement??{cash:0,bank:0,other:0,received:0,remaining:bill.amount,status:bill.amount===0?"paid":"unpaid"}}

export function validateGatepassPayment(value:unknown,total:number){
 if(value===undefined)return {cash:0,bank:0};
 if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Enter valid payment details");
 const p=value as Record<string,unknown>;
 const read=(value:unknown)=>{if(typeof value!=="number"||!Number.isFinite(value)||value<0||value>1e9)throw new Error("Enter valid Cash and Bank amounts");return cents(value)};
 const cash=read(p.cash??0),bank=read(p.bank??0),received=cash+bank,invoice=cents(total);
 if(!["unpaid","partial","paid"].includes(String(p.status)))throw new Error("Select a payment status");
 if(received>invoice)throw new Error("Payment received cannot exceed the invoice total");
 if(p.status==="unpaid"&&received!==0)throw new Error("An unpaid invoice cannot include received amounts");
 if(p.status==="partial"&&(received<=0||received>=invoice))throw new Error("Partial payment must be greater than zero and less than the invoice total");
 if(p.status==="paid"&&received!==invoice)throw new Error("Full payment must equal the invoice total");
 if(received>0){
  if(!["Cash","Bank","Split"].includes(String(p.method)))throw new Error("Select Cash, Bank or Cash + Bank");
  if(p.method==="Cash"&&bank!==0||p.method==="Bank"&&cash!==0)throw new Error("Received amounts do not match the payment method");
  if(p.method==="Split"&&(cash===0||bank===0))throw new Error("Enter both Cash and Bank amounts for a split payment");
 }
 return {cash:cash/100,bank:bank/100};
}
