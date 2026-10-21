import type {Bill,BillItem} from "./model";
// Older single-product invoices retain their original values.
export function invoiceItems(b:Bill):BillItem[]{return b.items??[{productId:"",product:b.product??"Product",quantity:b.quantity??1,rate:b.rate??b.amount,amount:b.subtotal??b.amount}]}
export function invoiceDescription(b:Bill){return invoiceItems(b).map(r=>`${r.product}: ${r.quantity} × Rs. ${r.rate.toLocaleString()}`).join("; ")}
export function invoiceDiscountLabel(b:Bill){return b.discountPercent===undefined?"Discount":`Discount (${b.discountPercent}%)`}
