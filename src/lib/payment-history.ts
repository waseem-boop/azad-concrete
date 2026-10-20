import type {Bill,Journal} from "./model";
import {money} from "./finance";

export type MoneyAccount="all"|"Cash"|"Bank"|"Cash / Bank";
export type Movement={id:string;date:string;reference:string;description:string;account:string;incoming:number;outgoing:number;balance:number;category:string;source?:string};
export function paymentHistory(journals:Journal[],bills:Bill[],account:MoneyAccount="all"):Movement[]{
 let balance=0;
 return journals.slice().reverse().sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).flatMap(j=>{
  const selected=j.lines.filter(l=>account==="all"?["Cash","Bank"].includes(l.account):l.account===account);
  if(!selected.length)return [];
  const incoming=money(selected.reduce((n,l)=>n+l.debit,0)),outgoing=money(selected.reduce((n,l)=>n+l.credit,0));
  if(!incoming&&!outgoing)return [];
  balance=money(balance+incoming-outgoing);
  const bill=bills.find(b=>b.id===j.reference),cashLines=j.lines.filter(l=>["Cash","Bank","Cash / Bank"].includes(l.account));
  const transfer=new Set(cashLines.map(l=>l.account)).size>1&&Math.abs(cashLines.reduce((n,l)=>n+l.debit-l.credit,0))<.005;
  const category=transfer?"Transfer":bill?.kind==="Payment"?"Customer payment":bill?.kind==="Expense"?"Expense":j.description.startsWith("Material receipt:")?"Material purchase":j.description.startsWith("Asset purchase:")?"Asset purchase":j.description.startsWith("Opening ")?"Opening balance":j.reference?.startsWith("FD-")?"Funds added":"Adjustment";
  const source=bill?.kind==="Payment"&&bill.customerId?`/customers?customer=${encodeURIComponent(bill.customerId)}`:bill?.kind==="Expense"?"/expenses":category==="Material purchase"?"/raw-material":category==="Asset purchase"?"/assets":undefined;
  return [{id:j.id,date:j.date,reference:j.reference??`TX-${j.id.slice(0,8).toUpperCase()}`,description:j.description,account:[...new Set(selected.map(l=>l.account))].join(" + "),incoming,outgoing,balance,category,source}];
 });
}
export function localDay(date:string){return new Date(date).toLocaleDateString("en-CA",{timeZone:"Asia/Karachi"})}
export function exportCsv(filename:string,rows:(string|number)[][]){
 const csv="\uFEFF"+rows.map(row=>row.map(value=>{let text=String(value);if(typeof value==="string"&&/^[=+@\-\t\r]/.test(text))text="'"+text;return `"${text.replaceAll('"','""')}"`}).join(",")).join("\r\n");
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})),link=document.createElement("a");link.href=url;link.download=filename;link.click();URL.revokeObjectURL(url);
}
