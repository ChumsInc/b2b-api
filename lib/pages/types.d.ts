import {ContentPage} from 'b2b-types'
import {RowDataPacket} from "mysql2";

export interface ContentPageRow extends RowDataPacket, Omit<ContentPage, 'status'> {
    status: 1|0;
    additionalData: string|null;
}

export type ContentPageBody = Partial<ContentPage>;
