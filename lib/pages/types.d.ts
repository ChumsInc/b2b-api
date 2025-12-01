import {ContentPage} from "chums-types/b2b"
import {RowDataPacket} from "mysql2";

export interface ContentPageRow extends RowDataPacket, Omit<ContentPage, 'status'> {
    status: 1|0;
    additionalData: string|null;
}

export type ContentPageBody = Partial<ContentPage>;

export interface ContentPageMoreData {
    lifestyle?: string;
    css?: string;
    subtitle?: string;
    requiresLogin?: boolean;
}
