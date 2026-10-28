import {createHash,randomUUID} from "node:crypto";
import type {State,JournalLine} from "./model";
import {money} from "./finance";
import {emptyPayroll,payrollDay,advanceBalance,salaryBalance,type Worker,type Attendance} from "./payroll-model";
function text(v:unknown,label:string,max:number,min=0){if(typeof v!=="string"||v.trim().length<min||v.trim().length>max)throw new Error(`Enter a valid ${label}`);return v.trim()}
function amount(v:unknown,positive=false){if(typeof v!=="number"||!Number.isFinite(v)||v<0||v>1e9||(positive&&money(v)<=0))throw new Error("Enter a valid amount");return money(v)}
function day(v:unknown){const d=text(v,"date",10,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d+"T00:00:00Z").toISOString().slice(0,10)!==d)throw new Error("Choose a valid date");return d}
// Called only inside the existing workspace transaction and permission checks.
export function recordPayroll(s:State,action:string,p:Record<string,unknown>,post:(description:string,reference:string,lines:JournalLine[])=>void,spend:(account:string,amount:number)=>void){
 const data=structuredClone(s.payroll??emptyPayroll());
 const requestId=text(p.requestId,"request ID",36,36);if(!/^[a-f0-9-]{36}$/i.test(requestId))throw new Error("Reopen the form and try again");
 const hash=createHash("sha256").update(JSON.stringify([action,p])).digest("hex"),previous=data.requests?.find(r=>r.id===requestId);
 if(previous){if(previous.hash!==hash)throw new Error("This request was already saved. Reopen the form");return}
 if(action==="worker"){
  const old=data.workers.find(w=>w.id===p.id);if(p.id&&!old)throw new Error("Person not found");
  if(p.kind!=="employee"&&p.kind!=="thakedaar")throw new Error("Choose Employee or Thakedaar");if(old&&old.kind!==p.kind)throw new Error("Person type cannot be changed");
  const joiningDate=day(p.joiningDate);if(joiningDate>payrollDay())throw new Error("Joining date cannot be in the future");
  if(typeof p.active!=="boolean")throw new Error("Choose a valid status");
  if(old&&[...data.attendance.filter(a=>a.workerId===old.id).map(a=>a.date),...data.salaries.filter(a=>a.workerId===old.id).map(a=>a.month+"-31")].some(d=>d<joiningDate))throw new Error("Joining date conflicts with existing records");
  const worker:Worker={id:old?.id??randomUUID(),kind:p.kind,name:text(p.name,"name",120,2),phone:text(p.phone,"phone",40),designation:text(p.designation,"designation",80,2),joiningDate,salary:amount(p.salary,true),active:p.active};
  data.workers=old?data.workers.map(w=>w.id===old.id?worker:w):[...data.workers,worker];
 }else{
  const worker=data.workers.find(w=>w.id===p.workerId);if(!worker)throw new Error("Person not found");
  if(action==="attendance"){
   if(worker.kind!=="employee")throw new Error("Attendance and leaves are only for employees");
   const date=day(p.date);if(date<worker.joiningDate||date>payrollDay())throw new Error("Attendance date must be between joining and today");
   const status=p.status as Attendance["status"];if(!["Present","Absent","Half-day","Paid leave","Unpaid leave"].includes(status))throw new Error("Choose attendance / leave status");
   data.attendance=data.attendance.filter(a=>a.workerId!==worker.id||a.date!==date);data.attendance.push({workerId:worker.id,date,status,note:text(p.note,"note",300)});
  }else if(action==="salary"){
   const month=text(p.month,"salary month",7,7);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month<worker.joiningDate.slice(0,7)||month>payrollDay().slice(0,7))throw new Error("Choose a salary month between joining and this month");
   if(data.salaries.some(r=>r.workerId===worker.id&&r.month===month))throw new Error("Salary already finalized for this month");
   const base=worker.salary,bonus=amount(p.bonus),deduction=amount(p.deduction),advanceApplied=amount(p.advanceApplied);
   if(deduction>money(base+bonus)||advanceApplied>advanceBalance(data,worker.id)||advanceApplied>money(base+bonus-deduction))throw new Error("Deduction or advance adjustment exceeds the available amount");
   data.salaries.push({id:randomUUID(),workerId:worker.id,month,base,bonus,deduction,advanceApplied,net:money(base+bonus-deduction-advanceApplied),note:text(p.note,"note",300)});
  }else if(action==="payroll-payment"){
   if(p.kind!=="advance"&&p.kind!=="salary")throw new Error("Choose a payment type");
   const salary=p.kind==="salary"?data.salaries.find(r=>r.id===p.salaryId&&r.workerId===worker.id):undefined;
   if(p.kind==="salary"&&!salary)throw new Error("Select a finalized salary");
   const paid=amount(p.amount,true),account=p.account;if(account!=="Cash"&&account!=="Bank")throw new Error("Choose Cash or Bank");
   if(salary&&paid>salaryBalance(data,salary))throw new Error("Payment exceeds remaining salary");
   const note=text(p.note,"note",300);spend(account,paid);
   const id=`PY-${randomUUID()}`,date=new Date().toISOString(),description=`${worker.kind==="thakedaar"?"Thakedaar":"Employee"} ${p.kind==="advance"?"advance":"salary"}: ${worker.name}${salary?` · ${salary.month}`:""}`;
   // Cash-basis payroll: disbursements post once; salary finalization and advance adjustment do not post expenses again.
   post(description,id,[{account:"Operating expenses",debit:paid,credit:0},{account,debit:0,credit:paid}]);
   s.bills.unshift({id,kind:"Expense",name:description,amount:paid,date,paymentAccount:account});
   data.payments.push({id,workerId:worker.id,salaryId:salary?.id,kind:p.kind,amount:paid,account,date,note});
  }else throw new Error("Unknown payroll action");
 }
 data.requests??=[];data.requests.push({id:requestId,hash});s.payroll=data;
}
