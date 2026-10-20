export const slabSizes = ["3 × 1", "3.5 × 1", "4 × 1", "4.5 × 1", "5 × 1", "5.5 × 1", "3 × 1.5", "3.5 × 1.5", "4 × 1.5", "4.5 × 1.5", "5 × 1.5", "5.5 × 1.5", "6 × 1.5"];
export type Product = {id:string;size:string;type:string;stock:number;length?:number;width?:number;height?:number;recipe?:number[];confirmed?:boolean};
export const products:Product[] = [...slabSizes.map((size,i)=>({id:`S${i}`,size,type:"Slab",length:Number(size.split(" × ")[0]),width:Number(size.split(" × ")[1]),stock:[248,186,324,210,156,98,132,164,278,192,224,116,86][i]})), ...Array.from({length:25},(_,i)=>({id:`G${i}`,size:`${10+i*.5} ft`,length:10+i*.5,type:"Girder",stock:24+i*3})), ...[[6,9,15],[4,10,17],[5,13,22]].map(([width,height,length],i)=>({id:`EX${i}`,size:`${width}″ × ${height}″ × ${length}′`,width,height,length,type:"Girder",stock:0}))];
export const initialMaterials = [{name:"Saria",detail:"Reinforcement steel",unit:"kg",stock:4850,capacity:6000,color:"#66746d"},{name:"Gitian",detail:"Crushed aggregate",unit:"cft",stock:1280,capacity:2000,color:"#8d9c86"},{name:"Cement",detail:"50 kg bags",unit:"bags",stock:86,capacity:500,color:"#d19a53"},{name:"Bajri",detail:"Fine gravel",unit:"cft",stock:940,capacity:1500,color:"#b0a58e"},{name:"Rait",detail:"Construction sand",unit:"cft",stock:1650,capacity:2200,color:"#c8b58d"}];
export type Entry={id:string;product:string;productId?:string;quantity:number;date:string};
export type Bill={id:string;name:string;amount:number;date:string;kind:string;product?:string;quantity?:number;rate?:number;customerId?:string};

export type Customer={id:string;name:string;phone:string};
export type JournalLine={account:string;debit:number;credit:number};
export type Journal={id:string;date:string;description:string;reference?:string;lines:JournalLine[]};
export type State={stock:Product[];materials:typeof initialMaterials;entries:Entry[];bills:Bill[];customers?:Customer[];journals?:Journal[]};
export function emptyState():State{return {stock:products.map(p=>({...p,stock:0})),materials:initialMaterials.map(m=>({...m,stock:0})),entries:[],bills:[],customers:[],journals:[]}}
