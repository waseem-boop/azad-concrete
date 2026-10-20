import "server-only";
import {createHash} from "node:crypto";
import type {Access} from "./permissions";
export function workspaceEtag(access:Access&{workspace_id:string},revision:string){
 return `"${createHash("sha256").update(JSON.stringify([access.workspace_id,revision,access.role,[...access.permissions].sort()])).digest("hex")}"`;
}
