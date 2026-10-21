export const permissionOptions=[
 {id:"dashboard",label:"Dashboard",description:"Production and stock overview"},
 {id:"stocks_view",label:"View stock & sizes",description:"See products and quantities"},
 {id:"stocks_manage",label:"Manage products",description:"Add/import sizes and edit sale prices"},
 {id:"materials_view",label:"View raw material",description:"See material receipts and quantities"},
 {id:"materials_manage",label:"Receive raw material",description:"Add stock and record purchases"},
 {id:"production",label:"Record production",description:"Record production and slab opening results"},
 {id:"gatepass_view",label:"View invoices",description:"View and print gatepasses"},
 {id:"gatepass_manage",label:"Create invoices",description:"Dispatch stock and issue gatepasses"},
 {id:"accounts_view",label:"View accounts",description:"Cash/bank history, financial reports and customer ledgers"},
 {id:"accounts_manage",label:"Customers & receipts",description:"Add customers and receive payments"},
 {id:"funds_manage",label:"Add funds & transfers",description:"Add owner funds, opening balances and cash/bank transfers"},
 {id:"journals_manage",label:"Manual journals",description:"Post balanced accounting adjustments"},
 {id:"expenses_view",label:"View expenses",description:"See expense records"},
 {id:"expenses_manage",label:"Record expenses",description:"Pay operating expenses"},
 {id:"assets_view",label:"View assets",description:"View equipment and condition"},
 {id:"assets_manage",label:"Manage assets",description:"Add equipment and change asset values"},
 {id:"settings_manage",label:"Factory settings",description:"Edit branding and material settings"}
] as const;
export type Permission=typeof permissionOptions[number]["id"];
export type Role="owner"|"staff"|"cashier"|"manager";
export const allPermissions=permissionOptions.map(p=>p.id);
export const legacyStaff:Permission[]=["dashboard","stocks_view","stocks_manage","materials_view","materials_manage","production","gatepass_view","gatepass_manage","accounts_view","accounts_manage","expenses_view","expenses_manage","assets_view"];
export const rolePresets:Record<Exclude<Role,"owner">,Permission[]>={staff:["dashboard","stocks_view","materials_view","production"],cashier:["gatepass_view","gatepass_manage","stocks_view","accounts_view","accounts_manage","expenses_view","expenses_manage"],manager:allPermissions.filter(p=>p!=="settings_manage"&&p!=="journals_manage")};
const dependencies:Partial<Record<Permission,Permission[]>>={stocks_manage:["stocks_view"],materials_manage:["materials_view"],production:["stocks_view"],gatepass_manage:["gatepass_view","stocks_view"],accounts_manage:["accounts_view"],expenses_manage:["expenses_view"],funds_manage:["accounts_view"],journals_manage:["accounts_view"],assets_manage:["assets_view"],settings_manage:["materials_view"]};
export function normalizePermissions(value:unknown):Permission[]{if(!Array.isArray(value)||value.some(p=>!allPermissions.includes(p)))throw new Error("Choose valid feature permissions");const result=new Set<Permission>(value);for(const p of result)for(const d of dependencies[p]??[])result.add(d);return [...result]}
export type Access={role:Role;permissions:Permission[]};
export function allowed(access:Access,p:Permission){return access.role==="owner"||access.permissions.includes(p)}
export const sectionPermission:Record<string,Permission>={dashboard:"dashboard",stocks:"stocks_view","raw-material":"materials_view",gatepass:"gatepass_view",accounts:"accounts_view",customers:"accounts_view",expenses:"expenses_view",assets:"assets_view",settings:"settings_manage",production:"production"};
export function landingPath(access:Access){const section=Object.keys(sectionPermission).find(k=>allowed(access,sectionPermission[k]));return section?`/${section}`:"/team"}
export const actionPermission:Record<string,Permission>={size:"stocks_manage","import-products":"stocks_manage",material:"materials_manage",production:"production","production-opening":"production",gatepass:"gatepass_manage",customer:"accounts_manage",payment:"accounts_manage",expense:"expenses_manage",asset:"assets_manage",funds:"funds_manage",opening:"funds_manage",transfer:"funds_manage",journal:"journals_manage",settings:"settings_manage","material-settings":"settings_manage"};
