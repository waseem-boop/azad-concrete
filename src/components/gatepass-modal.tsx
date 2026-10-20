"use client";
import {useState} from "react";
import Link from "next/link";
import {Plus,Trash2} from "lucide-react";
import type {Customer,CustomerKind,Product} from "@/lib/model";
import {money} from "@/lib/finance";
import AppDialog from "./app-dialog";
import ProductPicker from "./product-picker";

type Props={stock:Product[];customers:Customer[];customerId:string;busy:boolean;error:string;onClose:()=>void;onSave:(p:Record<string,unknown>)=>Promise<void>};
const rupees=(n:number)=>`Rs. ${n.toLocaleString("en-PK",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export default function GatepassModal({stock,customers,customerId,busy,error,onClose,onSave}:Props){
 const initial=customers.find(c=>c.id===customerId);
 const [kind,setKind]=useState<CustomerKind>(initial?.kind??"dealer"),[customer,setCustomer]=useState(customerId),[discount,setDiscount]=useState("");
 const [items,setItems]=useState([{id:"first",product:"",quantity:"1",rate:""}]);
 const [productError,setProductError]=useState("");
 const subtotal=money(items.reduce((n,r)=>n+(Number(r.quantity)||0)*(Number(r.rate)||0),0)),deduction=kind==="dealer"?Number(discount)||0:0;
 function update(id:string,key:"product"|"quantity"|"rate",value:string){setItems(rows=>rows.map(r=>r.id!==id?r:key==="product"?{...r,product:value,rate:String(stock.find(p=>p.id===value)?.salePrice||"")}:{...r,[key]:value}))}
 return <AppDialog title="Create gatepass" wide busy={busy} onClose={onClose}><form className="money-form gatepass-form" onSubmit={e=>{e.preventDefault();if(items.some(r=>!r.product)){setProductError("Select a product for every item.");e.currentTarget.querySelector<HTMLButtonElement>('[data-product-empty="true"]')?.focus();return}setProductError("");const f=new FormData(e.currentTarget);void onSave({customerType:kind,customerId:customer||undefined,name:f.get("name"),phone:f.get("phone")??"",items:items.map(r=>({product:r.product,quantity:Number(r.quantity),rate:Number(r.rate)})),discount:deduction})}}>
  <fieldset disabled={busy} className="record-fields">
   <div className="customer-kind-picker" role="group" aria-label="Customer type">{(["dealer","walk-in"] as const).map(k=><button key={k} type="button" aria-pressed={kind===k} className={kind===k?"selected":""} onClick={()=>{setKind(k);setCustomer("");setDiscount("")}}>{k==="dealer"?"Dealer":"Walk-in customer"}</button>)}</div>
   {kind==="dealer"?<label>Dealer<select value={customer} onChange={e=>setCustomer(e.target.value)} required><option value="" disabled>Select a dealer</option>{customers.filter(c=>(c.kind??"dealer")==="dealer").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>{!customers.some(c=>(c.kind??"dealer")==="dealer")&&<small>Add a dealer on the <Link href="/customers">Customers page</Link>.</small>}</label>:<>
    {customers.some(c=>c.kind==="walk-in")&&<label>Walk-in customer<select value={customer} onChange={e=>setCustomer(e.target.value)}><option value="">New walk-in customer</option>{customers.filter(c=>c.kind==="walk-in").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
    {!customer&&<><label>Customer name<input name="name" required minLength={2} maxLength={120} placeholder="Enter customer name"/></label><details className="optional-phone"><summary>Add phone number (optional)</summary><label>Phone<input name="phone" type="tel" maxLength={40}/></label></details></>}
   </>}
   <div className="gatepass-products-heading"><h3>Products</h3><span>{items.length} {items.length===1?"item":"items"}</span></div>
   <div className="gatepass-items">{items.map((r,i)=>{const product=stock.find(p=>p.id===r.product);return <div className="gatepass-item" key={r.id}>
    <div className="gatepass-item-title"><strong>Item {i+1}</strong>{items.length>1&&<button type="button" className="text-button" aria-label={`Remove item ${i+1}`} onClick={()=>setItems(rows=>rows.filter(x=>x.id!==r.id))}><Trash2 size={14}/>Remove</button>}</div>
    <ProductPicker stock={stock} value={r.product} label={`Product ${i+1}`} invalid={!!productError&&!r.product} onChange={id=>{update(r.id,"product",id);setProductError("")}}/>
    {product&&product.stock<=0&&<p className="gatepass-stock-warning">This size has no finished stock. Record production in Stocks before creating its gatepass.</p>}
    <label>Quantity<input aria-label={`Quantity ${i+1}`} type="number" min="1" step="1" max={product?.stock||undefined} required value={r.quantity} onChange={e=>update(r.id,"quantity",e.target.value)}/></label>
    <label>Price / piece (Rs.)<input aria-label={`Unit price ${i+1}`} type="number" min="0.01" step="0.01" max="1000000000" required value={r.rate} onChange={e=>update(r.id,"rate",e.target.value)}/></label>
    <div className="gatepass-line-total"><span>Amount</span><strong>{rupees(money((Number(r.quantity)||0)*(Number(r.rate)||0)))}</strong></div>
   </div>})}</div>
   <button type="button" className="secondary add-product-button" disabled={items.length>=50} onClick={()=>setItems(rows=>[...rows,{id:crypto.randomUUID(),product:"",quantity:"1",rate:""}])}><Plus size={15}/>Add another product</button>
   <div className="gatepass-summary"><div><span>Subtotal</span><strong>{rupees(subtotal)}</strong></div>{kind==="dealer"&&<label>Discount (Rs.)<input name="discount" type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={e=>setDiscount(e.target.value)} placeholder="0.00"/></label>}<div className="gatepass-grand-total"><span>Invoice total</span><strong>{rupees(money(Math.max(0,subtotal-deduction)))}</strong></div></div>
  </fieldset>
  {(error||productError)&&<p className="form-error" role="alert">{productError||error}</p>}
  <div className="money-form-actions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="primary" disabled={busy||!stock.length}>{busy?"Saving…":"Create gatepass"}</button></div>
 </form></AppDialog>
}
