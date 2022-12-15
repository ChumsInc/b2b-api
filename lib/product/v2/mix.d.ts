import { ProductMixVariant } from "b2b-types";
import { RowDataPacket } from "mysql2";
export declare function loadMix(id: number | string): Promise<ProductMixVariant | null>;
export interface SageBillComponent {
    id: number;
    mixID: number;
    itemCode?: string | null;
    colorsId?: number | null;
    colorCode?: string | null;
    colorName?: string | null;
}
export interface SageBillComponentRow extends SageBillComponent, RowDataPacket {
}
export declare function loadSageBillComponents({ id }: {
    id: any;
}): Promise<SageBillComponent[]>;
export declare function saveMix({ productId, itemCode, mixName, status }: Partial<ProductMixVariant>): Promise<ProductMixVariant | null>;
export declare function getMix(req: any, res: any): Promise<any>;
export declare function getSageBOM(req: any, res: any): Promise<any>;
export declare function postMix(req: any, res: any): Promise<any>;
export declare function postMixItems(req: any, res: any): Promise<any>;
export declare function delMixItem(req: any, res: any): Promise<undefined>;
