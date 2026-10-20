"use client";
import {useState} from "react";
import type {Material} from "@/lib/model";
import {materialUnits,money} from "@/lib/finance";
import AppDialog from "./app-dialog";
type Props={materials:Material[];materialName?:string;busy:boolean;error:string;onClose:()=>void;onSave:(p:Record<string,unknown>)=>Promise<void>};
export default function MaterialReceiptModal({materials,materialName,busy,error,onClose,onSave}:Props){
 const initial=materials.find(m=>m.name===materialName),[name,setName]=useState(materialName??""),[unit,setUnit]=useState(initial?materialUnits(initial)[0]:""),[quantity,setQuantity]=useState("1"),[rate,setRate]=useState("0");
 const material=materials.find(m=>m.name===name),amount=money((Number(quantity)||0)*(Number(rate)||0));
 return <AppDialog title={materialName?`Receive ${materialName}`:"Add raw material"} busy={busy} onClose={onClose}><form className="money-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void onSave({product:name,quantity:Number(quantity),unit,capacitySqft:unit==="trali"?Number(f.get("capacitySqft")):undefined,rate:Number(rate),account:f.get("account"),note:f.get("note")})}}>
  <fieldset disabled={busy} className="record-fields">
   {materialName?<div className="receipt-material-name">{materialName}</div>:<label>Material<select value={name} required onChange={e=>{const m=materials.find(m=>m.name===e.target.value)!;setName(m.name);setUnit(materialUnits(m)[0]);setQuantity("1")}}><option value="" disabled>Select material</option>{materials.map(m=><option key={m.name}>{m.name}</option>)}</select></label>}
   {material&&<><div className="money-form-grid"><label>Receipt unit<select value={unit} onChange={e=>{setUnit(e.target.value);setQuantity("1")}}>{materialUnits(material).map(u=><option key={u} value={u}>{u==="bags"?"Bags (50 kg)":u==="trali"?"Trali":u}</option>)}</select></label><label>{unit==="trali"?"Number of tralis":`Quantity (${unit})`}<input type="number" required min={unit==="trali"?"1":"0.0001"} step={unit==="trali"?"1":"0.0001"} max="1000000000" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label></div>
   {unit==="trali"&&<label>Size of each trali (square feet / ft²)<input name="capacitySqft" type="number" required min="0.01" step="0.01" max="1000000000" placeholder="e.g. 150"/></label>}
   <label>Purchase rate per {unit} (Rs.)<input type="number" min="0" step="0.01" required max="1000000000" value={rate} onChange={e=>setRate(e.target.value)}/></label>
   {amount>0&&<label>Paid from / credit purchase<select name="account" required><option>Cash</option><option>Bank</option><option>Accounts payable</option></select></label>}
   <label>Note (optional)<input name="note" maxLength={300} placeholder="Supplier or delivery reference"/></label>
   <div className="receipt-total"><span>Receipt total</span><strong>Rs. {amount.toLocaleString("en-PK")}</strong></div></>}
  </fieldset>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <div className="money-form-actions"><button className="secondary" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="primary" disabled={busy||!material}>{busy?"Saving…":"Save receipt"}</button></div>
 </form></AppDialog>
}
