import {RowDataPacket} from "mysql2";

export interface ErrorReport {
    id?: number;
    version: string|null;
    ip_address: string;
    user_id: number|null;
    url: string|null;
    componentStack:string|null;
    debug?: unknown;
    message: string;
    user_agent: string;
    referrer: string;
    timestamp?: string;
}

export interface ErrorReportArg extends Omit<ErrorReport, 'ip_address'|'id'|'timestamp'> {
    ip: string;
}

export interface ErrorReportRow extends RowDataPacket, Omit<ErrorReport, 'debug'> {
    debug: string|null;
}
