import {money} from "./finance";
export type Worker={id:string;kind:"employee"|"thakedaar";name:string;phone:string;designation:string;joiningDate:string;salary:number;active:boolean};
export type Salary={id:string;workerId:string;month:string;base:number;bonus:number;deduction:number;advanceApplied:number;net:number;note:string};
export type PayrollPayment={id:string;workerId:string;salaryId?:string;kind:"advance"|"salary";amount:number;account:string;date:string;note:string};
export type Attendance={workerId:string;date:string;status:"Present"|"Absent"|"Half-day"|"Paid leave"|"Unpaid leave";note:string};
export type PayrollState={workers:Worker[];salaries:Salary[];payments:PayrollPayment[];attendance:Attendance[];requests?:{id:string;hash:string}[]};
export const emptyPayroll=():PayrollState=>({workers:[],salaries:[],payments:[],attendance:[]});
export const payrollDay=()=>new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Karachi"});
export function advanceBalance(data:PayrollState,id:string){return money(data.payments.filter(p=>p.workerId===id&&p.kind==="advance").reduce((n,p)=>n+p.amount,0)-data.salaries.filter(s=>s.workerId===id).reduce((n,s)=>n+s.advanceApplied,0))}
export function salaryBalance(data:PayrollState,s:Salary){return money(s.net-data.payments.filter(p=>p.salaryId===s.id).reduce((n,p)=>n+p.amount,0))}
