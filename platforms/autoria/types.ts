import { CarData } from "../../parser/types";

export interface PriceStatistic {
    pageLink: string;
    prices: number[];
    priceType: 'low' | 'lowest' | 'high';
    carData: CarData;
}

export interface Model { name: string; years: number[][] }
export interface Brand { name: string; models: Model[]}