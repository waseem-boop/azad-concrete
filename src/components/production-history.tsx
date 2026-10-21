"use client";
import {useState} from "react";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {ArrowRight,CalendarDays} from "lucide-react";
import type {Entry,Product} from "@/lib/model";
import {batchProduct,isSlabBatch,productionDay} from "@/lib/production-opening";
import {SkeletonList,SkeletonRows} from "./loading-data";
export const openingDateLabel=(date:string)=>new Date(`${date}T12:00:00Z`).toLocaleDateString("en-PK",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Karachi"});
type Props={entries:Entry[];stock:Product[];loading:boolean;compact?:boolean};
export default function ProductionHistory({entries,stock,loading,compact=false}:Props){
 const params=useSearchParams(),date=params.get("date")??"",productId=params.get("product")??"";
 const [status,setStatus]=useState("all");
 const batches=entries.filter(isSlabBatch).filter(e=>!productId||batchProduct(e,stock)?.id===productId);
 const days=[...new Set(batches.map(e=>productionDay(e.date)))].sort().reverse();
 const rows=batches.filter(e=>(!date||productionDay(e.date)===date)&&(status==="all"||status==="opened"&&e.opening||status==="pending"&&!e.opening)).slice().sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
 const query=(day?:string)=>`/production${day||productId?`?${new URLSearchParams({...day?{date:day}:{},...productId?{product:productId}:{}})}`:""}`;
 return <section className={`panel production-history${compact?" production-history-compact":""}`}><div className="panel-heading"><div><h2>Slab production &amp; openings</h2><p>{compact?"Select a production date to view its batches and opening results.":"Open a batch to record good and damaged slabs."}</p></div>{compact?<Link className="secondary" href="/production">View all batches <ArrowRight size={14}/></Link>:<Link className="secondary" href="/stocks">Back to Stocks</Link>}</div>
 {loading?<SkeletonList rows={3}/>:days.length?<div className="production-date-list">{(compact?days.slice(0,7):days).map(day=>{const items=batches.filter(e=>productionDay(e.date)===day),pending=items.filter(e=>!e.opening).length;return <Link key={day} className={`production-date-card${date===day?" selected":""}`} href={query(day)}><CalendarDays size={18}/><strong>{openingDateLabel(day)}</strong><span>{items.reduce((n,e)=>n+e.quantity,0).toLocaleString()} slabs · {items.length} {items.length===1?"batch":"batches"}</span><small>{pending?`${pending} awaiting opening`:"All openings recorded"}</small><ArrowRight size={15}/></Link>})}</div>:<div className="money-empty"><h3>No slab production yet</h3><p>Record production with the + button. Its date and batch will appear here.</p></div>}
 {!compact&&<><div className="production-history-filters"><div className="tabs">{[{id:"all",name:"All batches"},{id:"pending",name:"Opening Pending"},{id:"opened",name:"Opening Completed"}].map(t=><button type="button" key={t.id} className={status===t.id?"selected":""} onClick={()=>setStatus(t.id)}>{t.name}</button>)}</div>{date&&<span>{openingDateLabel(date)} <Link className="text-button" href={query()}>Clear date</Link></span>}</div><div className="money-table-scroll"><table className="money-table"><thead><tr><th>Production date / batch</th><th>Slab size</th><th className="numeric">Produced</th><th className="numeric">Good</th><th className="numeric">Damaged</th><th>Opening date</th><th>Status</th><th/></tr></thead><tbody>{loading?<SkeletonRows columns={8}/>:rows.map(entry=><tr key={entry.id}><td>{openingDateLabel(productionDay(entry.date))}<small>{entry.id}</small></td><td>{entry.product}</td><td className="numeric">{entry.quantity.toLocaleString()}</td><td className="numeric">{entry.opening?entry.opening.good.toLocaleString():"—"}</td><td className="numeric">{entry.opening?entry.opening.damaged.toLocaleString():"—"}</td><td>{entry.opening?openingDateLabel(entry.opening.date):"—"}</td><td><span className="opening-status" data-opened={!!entry.opening}>{entry.opening?"Opening Completed":"Opening Pending"}</span></td><td><Link className="text-button" href={`/production/${encodeURIComponent(entry.id)}`}>{entry.opening?"View record":"Open batch"} <ArrowRight size={13}/></Link></td></tr>)}</tbody></table>{!loading&&batches.length>0&&!rows.length&&<div className="money-empty"><h3>No matching batches</h3><p>Change the date or status filter.</p></div>}</div></>}
 </section>
}
