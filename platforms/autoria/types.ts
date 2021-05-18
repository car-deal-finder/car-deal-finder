import { CarData } from "../../parser/types";

export interface PriceStatistic {
    pageLink: string;
    prices: number[];
    priceType: 'low' | 'lowest' | 'high';
    carData: CarData;
}