import {PDFDocument,rgb,type PDFFont,type PDFPage} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type {Bill,FactorySettings} from "./model";
import {invoiceDiscountLabel,invoiceItems} from "./invoice";
import {paymentStatusLabel,settlementFor} from "./invoice-settlement";

export type InvoicePdfAssets={regular:Uint8Array;bold:Uint8Array;logoPng?:Uint8Array};
const currency=(n:number)=>`Rs. ${n.toLocaleString("en-PK",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const ink=rgb(.10,.15,.23),muted=rgb(.36,.41,.49),blue=rgb(.19,.36,.65),line=rgb(.85,.88,.92),pale=rgb(.95,.97,.99);
const clean=(s:string)=>s.replace(/[\r\n\t]+/g," ").replace(/[\u0000-\u001f]/g,"").trim();

export async function createInvoicePdf(bill:Bill,settings:FactorySettings,preparedBy:string,assets:InvoicePdfAssets){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const regular=await doc.embedFont(assets.regular,{subset:true}),bold=await doc.embedFont(assets.bold,{subset:true});
 const logo=assets.logoPng?await doc.embedPng(assets.logoPng):null;
 doc.setTitle(`Invoice ${bill.id} - ${settings.name}`);doc.setAuthor(settings.name);doc.setCreator("Azad Concrete ERP");
 let page:PDFPage,y=0;
 const text=(value:string,x:number,top:number,size=12,font:PDFFont=regular,color=ink)=>page.drawText(clean(value),{x,y:842-top-size,font,size,color});
 const right=(value:string,end:number,top:number,size=12,font:PDFFont=regular,color=ink)=>text(value,end-font.widthOfTextAtSize(clean(value),size),top,size,font,color);
 function wrapped(value:string,width:number,size=12,font:PDFFont=regular){
  const lines:string[]=[];let current="";
  for(const word of clean(value).split(/\s+/)){if(!word)continue;const candidate=current?`${current} ${word}`:word;if(font.widthOfTextAtSize(candidate,size)<=width){current=candidate;continue}if(current)lines.push(current);current="";for(const char of word){if(font.widthOfTextAtSize(current+char,size)>width&&current){lines.push(current);current=""}current+=char}}
  if(current)lines.push(current);return lines.length?lines:[""];
 }
 function paragraph(value:string,x:number,top:number,width:number,size=12,font=regular,color=ink){const lines=wrapped(value,width,size,font);lines.forEach((l,i)=>text(l,x,top+i*(size+5),size,font,color));return lines.length*(size+5)}
 function newPage(continued=false){
  page=doc.addPage([595,842]);page.drawRectangle({x:0,y:832,width:595,height:10,color:blue});
  if(continued){text(settings.name,42,30,14,bold);right(`Invoice ${bill.id}`,553,32,11,regular,muted);page.drawLine({start:{x:42,y:784},end:{x:553,y:784},thickness:.7,color:line});y=74}else y=40;
 }
 function ensure(height:number){if(y+height>770)newPage(true)}
 function tableHeader(){page.drawRectangle({x:42,y:842-y-30,width:511,height:30,color:pale});text("PRODUCT / SIZE",54,y+8,10,bold,muted);right("QTY",315,y+8,10,bold,muted);right("PRICE / PIECE",425,y+8,10,bold,muted);right("AMOUNT",541,y+8,10,bold,muted);y+=30}
 newPage();
 let brandX=42;
 if(logo){const scale=Math.min(62/logo.width,54/logo.height);page!.drawImage(logo,{x:42,y:842-y-54,width:logo.width*scale,height:logo.height*scale});brandX=118}
 const nameHeight=paragraph(settings.name,brandX,y,300-(brandX-42),20,bold);right("INVOICE",553,y,22,bold,blue);
 const details=[settings.address,settings.phone].filter(Boolean).join(" · ");let brandBottom=y+nameHeight+5;if(details)brandBottom+=paragraph(details,brandX,brandBottom,300-(brandX-42),11,regular,muted);
 y=Math.max(brandBottom,105)+20;page!.drawLine({start:{x:42,y:842-y},end:{x:553,y:842-y},color:line,thickness:1});y+=20;
 text("BILL TO",42,y,10,bold,muted);right(bill.id,553,y,12,bold);y+=20;
 const customerHeight=paragraph(bill.name,42,y,290,16,bold);right(new Date(bill.date).toLocaleDateString("en-PK",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Karachi"}),553,y+3,12,regular,muted);y+=customerHeight+3;
 text(`${bill.customerType==="walk-in"?"Walk-in customer":"Dealer"}${bill.phone?` · ${bill.phone}`:""}`,42,y,12,regular,muted);y+=35;
 tableHeader();
 for(const item of invoiceItems(bill)){
  const lines=wrapped(item.product,196),height=Math.max(46,lines.length*17+20);
  if(y+height>750){newPage(true);tableHeader()}
  lines.forEach((l,i)=>text(l,54,y+12+i*17));right(item.quantity.toLocaleString("en-PK"),315,y+12);right(currency(item.rate),425,y+12,11);right(currency(item.amount),541,y+12,11,bold);
  y+=height;page!.drawLine({start:{x:42,y:842-y},end:{x:553,y:842-y},thickness:.5,color:line});
 }
 y+=20;ensure(290);
 const payment=settlementFor(bill);
 function total(label:string,value:number,emphasis=false){if(emphasis)page.drawRectangle({x:306,y:842-y-35,width:247,height:35,color:pale});text(label,emphasis?318:306,y+8,12,emphasis?bold:regular);right(currency(value),541,y+8,12,bold);y+=emphasis?43:29}
 total("Subtotal",bill.subtotal??invoiceItems(bill).reduce((n,r)=>n+r.amount,0));if(bill.discount)total(invoiceDiscountLabel(bill),-bill.discount);total("Invoice total",bill.amount,true);
 text("PAYMENT",42,y+4,10,bold,muted);text(paymentStatusLabel[payment.status],42,y+22,12,bold,blue);
 total("Cash received",payment.cash);total("Bank received",payment.bank);if(payment.other>0)total("Other receipts",payment.other);total("Total received",payment.received);total("Remaining credit",payment.remaining,true);
 if(settings.invoiceNote){y+=12;for(const l of wrapped(settings.invoiceNote,511,11)){ensure(18);text(l,42,y,11,regular,muted);y+=17}}
 y+=34;const signatureLines=wrapped(`Prepared by: ${preparedBy}`,250,11);ensure(Math.max(64,signatureLines.length*16+20));signatureLines.forEach((l,i)=>text(l,42,y+i*16,11,regular,muted));text("Received by: __________________",340,y,11,regular,muted);
 doc.getPages().forEach((p,i)=>{page=p;page.drawLine({start:{x:42,y:42},end:{x:553,y:42},thickness:.5,color:line});text(`Gatepass / Invoice · ${bill.id}`,42,811,10,regular,muted);right(`Page ${i+1} of ${doc.getPageCount()}`,553,811,10,regular,muted)});
 return doc.save();
}
