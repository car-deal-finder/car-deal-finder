import { CarData } from "../../parser/types";

export interface PriceStatistic {
    pageLink: string;
    prices: number[];
    isPriceLow: boolean;
    carData: CarData;
}