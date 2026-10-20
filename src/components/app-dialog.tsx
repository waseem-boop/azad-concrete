"use client";
import {useEffect,useRef,type ReactNode} from "react";
import {X} from "lucide-react";
export default function AppDialog({title,description,children,onClose,busy=false,wide=false}:{title:string;description?:string;children:ReactNode;onClose:()=>void;busy?:boolean;wide?:boolean}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;if(!dialog)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";dialog.showModal();return ()=>{dialog.close();document.body.style.overflow=previous}},[]);
 return <dialog className={wide?"finance-dialog finance-dialog-wide":"finance-dialog"} ref={ref} aria-label={title} onCancel={e=>{e.preventDefault();if(!busy)onClose()}}><div className="finance-dialog-heading"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div><button type="button" className="icon-button" aria-label="Close" disabled={busy} onClick={onClose}><X size={19}/></button></div><div className="finance-dialog-body">{children}</div></dialog>
}
