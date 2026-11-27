import {apiRequest,readAllPages} from "./task-api";
import type {ProgressReport} from "./employer-api";
export interface ExecutorTaskCard {task_id:string;title:string;status:string;}
export interface ExecutorTask extends ExecutorTaskCard {description:string;delivery_criteria:string;agreed_wage_amount:number;currency_code:string;due_at:string|null;progress_percent:number;can_start:boolean;can_report_progress:boolean;can_submit_delivery:boolean;can_view_private_details:boolean;}
export interface Delivery {delivery_id:string;summary:string;evidence_urls:string[];created_at:string;status:string;}
export interface PrivateDetails {employer_name:string;employer_phone:string;locations:{task_location_id:string;city:string;region:string;latitude:number|null;longitude:number|null;location_notes:string|null;exact_address:string|null}[];}
const path=(id:string)=>`/api/executor/tasks/${encodeURIComponent(id)}/`;
export const listExecutorTasks=(signal?:AbortSignal)=>readAllPages<ExecutorTaskCard>("/api/executor/tasks/",signal);
export const getExecutorTask=(id:string,signal?:AbortSignal)=>apiRequest<ExecutorTask>(path(id),{signal});
export const getPrivateDetails=(id:string,signal?:AbortSignal)=>apiRequest<PrivateDetails>(`${path(id)}private-details/`,{signal});
export const getExecutorReports=(id:string,signal?:AbortSignal)=>readAllPages<ProgressReport>(`${path(id)}progress-reports/`,signal);
export const getDelivery=(id:string,signal?:AbortSignal)=>apiRequest<Delivery>(`${path(id)}delivery/`,{signal});
export const startTask=(id:string)=>apiRequest(`/api/tasks/${encodeURIComponent(id)}/start/`,{method:"POST"});
export const reportProgress=(id:string,input:{progress_percent:25|50|75|100;description:string;on_schedule:boolean})=>apiRequest<ProgressReport>(`${path(id)}progress-reports/`,{method:"POST",body:JSON.stringify(input)});
export const submitDelivery=(id:string,input:{summary:string;evidence_urls:string[]})=>apiRequest<Delivery>(`${path(id)}delivery/`,{method:"POST",body:JSON.stringify(input)});
