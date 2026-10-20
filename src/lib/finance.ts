import type {Journal,Material} from "./model";
export const money=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function accountBalance(journals:Journal[],account:string){return money(journals.reduce((a,j)=>a+j.lines.filter(l=>l.account===account).reduce((n,l)=>n+l.debit-l.credit,0),0))}
export function materialUnits(m:Material){return m.name==="Cement"?["bags","kg"]:m.name==="Saria"?["kg","tonne"]:m.name==="Gitian"?["kg","cft"]:m.name==="Rait"||m.name==="Bajri"?["trali","cft"]:[m.unit]}
// Only convert compatible measurements. A trali's square-foot size is recorded separately.
export function unitFactor(m:Material,unit:string){if(!materialUnits(m).includes(unit))throw new Error(`Invalid unit for ${m.name}`);if(unit===m.unit)return 1;if(m.name==="Cement"&&unit==="kg"&&m.unit==="bags")return 1/50;if(m.name==="Saria"&&unit==="tonne"&&m.unit==="kg")return 1000;throw new Error(`Cannot convert ${unit} to ${m.unit}`)}
export function materialQuantityText(m:Material){return [[m.unit,m.stock] as const,...Object.entries(m.quantities??{})].filter(([,q],i,rows)=>q!==0||i===0&&rows.every(([,v])=>v===0)).map(([unit,q])=>`${q.toLocaleString("en-PK")} ${unit}`).join(" · ")}
export const cashAccounts=["Cash","Bank"];
export const ledgerAccounts=["Cash","Bank","Cash / Bank","Accounts receivable","Raw material inventory","Finished goods inventory","Equipment","Accounts payable","Capital","Asset revaluation","Sales","Operating expenses","Cost of goods sold"];
