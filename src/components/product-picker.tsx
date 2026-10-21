"use client";

import {useEffect,useId,useRef,useState} from "react";
import {Check,ChevronDown,Layers3,Package,Search} from "lucide-react";
import type {Product} from "@/lib/model";
import {sellableQuantity} from "@/lib/stock-availability";

type Filter="All"|"Slab"|"Girder";
type Props={stock:Product[];value:string;label:string;invalid?:boolean;onChange:(id:string)=>void};
function searchable(text:string){return text.toLowerCase().replace(/[×x]/g," ").replace(/[′″'"·]/g,"").replace(/\s+/g," ").trim()}

export default function ProductPicker({stock,value,label,invalid=false,onChange}:Props){
 const id=useId(),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),search=useRef<HTMLInputElement>(null),list=useRef<HTMLDivElement>(null),panel=useRef<HTMLDivElement>(null);
 const [open,setOpen]=useState(false),[filter,setFilter]=useState<Filter>("All"),[query,setQuery]=useState("");
 const selected=stock.find(p=>p.id===value),rows=stock.filter(p=>(filter==="All"||p.type===filter)&&searchable(`${p.type} ${p.size}`).includes(searchable(query)));
 useEffect(()=>{
  if(!open)return;
  const popup=panel.current,button=trigger.current;if(!popup||!button)return;
  const bounds=button.getBoundingClientRect(),width=Math.min(bounds.width,480,window.innerWidth-32),spaceBelow=window.innerHeight-bounds.bottom-16,spaceAbove=bounds.top-16;
  const above=spaceBelow<280&&spaceAbove>spaceBelow,space=above?spaceAbove:spaceBelow,height=Math.min(344,Math.max(180,space));
  popup.style.width=`${width}px`;popup.style.maxHeight=`${height}px`;popup.style.left=`${Math.max(16,Math.min(bounds.left,window.innerWidth-width-16))}px`;
  popup.style.top=above?"auto":`${bounds.bottom+6}px`;popup.style.bottom=above?`${window.innerHeight-bounds.top+6}px`:"auto";
  popup.showPopover();
  search.current?.focus();
  function outside(event:PointerEvent){if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false)}
  function reposition(event:Event){if(event.target instanceof Node&&popup?.contains(event.target))return;setOpen(false)}
  document.addEventListener("pointerdown",outside);window.addEventListener("resize",reposition);document.addEventListener("scroll",reposition,true);
  return ()=>{if(popup.matches(":popover-open"))popup.hidePopover();document.removeEventListener("pointerdown",outside);window.removeEventListener("resize",reposition);document.removeEventListener("scroll",reposition,true)};
 },[open]);
 function choose(product:Product){onChange(product.id);setOpen(false);trigger.current?.focus()}
 function move(current:HTMLElement|null,step:number){const options=Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)')??[]);if(!options.length)return;const index=options.findIndex(p=>p===current);options[index<0?(step>0?0:options.length-1):(index+step+options.length)%options.length]?.focus()}
 return <div className="gatepass-product product-picker" ref={root} onBlur={e=>{if(e.relatedTarget&&!e.currentTarget.contains(e.relatedTarget))setOpen(false)}} onKeyDown={e=>{if(e.key==="Escape"&&open){e.preventDefault();e.stopPropagation();setOpen(false);trigger.current?.focus()}}}>
  <span className="product-picker-label" id={`${id}-label`}>Product / size</span>
  <button ref={trigger} type="button" role="combobox" className="product-picker-trigger" aria-label={label} aria-expanded={open} aria-haspopup="listbox" aria-controls={`${id}-list`} aria-invalid={invalid||undefined} data-product-empty={!value||undefined} onClick={()=>{setQuery("");setOpen(!open)}} onKeyDown={e=>{if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();setQuery("");setOpen(true)}}}>
   <span>{selected?`${selected.type} · ${selected.size}${selected.type==="Slab"?" ft":""}`:"Select a product"}</span><ChevronDown size={16} aria-hidden="true"/>
  </button>
  {open&&<div ref={panel} popover="manual" className="product-picker-panel">
   <div className="product-picker-search"><Search size={15} aria-hidden="true"/><input ref={search} aria-label={`Search sizes for ${label.toLowerCase()}`} placeholder="Search size…" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();move(null,e.key==="ArrowDown"?1:-1)}if(e.key==="Enter"){e.preventDefault();if(rows.length===1)choose(rows[0]);else move(null,1)}}}/></div>
   <div className="product-picker-filters" role="group" aria-label={`Filter ${label.toLowerCase()}`}>{(["All","Slab","Girder"] as const).map(kind=><button type="button" key={kind} aria-pressed={filter===kind} onClick={()=>setFilter(kind)}>{kind==="All"?"All":kind==="Slab"?"Slabs":"Girders"}<span>{stock.filter(p=>kind==="All"||p.type===kind).length}</span></button>)}</div>
   <div className="product-picker-options" role="listbox" id={`${id}-list`} aria-label={`${label} sizes`} ref={list}>{rows.map(p=><button type="button" role="option" aria-selected={p.id===value} tabIndex={-1} key={p.id} onClick={()=>choose(p)} onKeyDown={e=>{if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();move(e.currentTarget,e.key==="ArrowDown"?1:-1)}else if(e.key==="Home"||e.key==="End"){e.preventDefault();move(null,e.key==="Home"?1:-1)}}}>
    <span className="product-picker-icon">{p.type==="Slab"?<Layers3 size={16}/>:<Package size={16}/>}</span><span className="product-picker-option-name"><strong>{p.size}{p.type==="Slab"?" ft":""}</strong><small>{p.type}</small></span><span className="product-picker-availability" data-empty={sellableQuantity(p)<=0||undefined}>{sellableQuantity(p)>0?`${sellableQuantity(p).toLocaleString()} available`:p.type==="Slab"&&p.stock>0?"Opening pending":"No stock"}</span><span className="product-picker-selected">{p.id===value&&<Check size={15} aria-hidden="true"/>}</span>
   </button>)}{!rows.length&&<div className="product-picker-empty">{query?"No matching sizes":filter==="Slab"?"No slab sizes added":filter==="Girder"?"No girder sizes added":"No products added"}</div>}</div>
  </div>}
 </div>
}
