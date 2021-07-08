import { CarData } from "../../parser/types";

export interface PriceStatistic {
    pageLink: string;
    prices: number[];
    priceType: 'low' | 'lowest' | 'high';
    carData: CarData;
}

export interface Brand { name: string; models: { name: string; years: number[][] }[]}