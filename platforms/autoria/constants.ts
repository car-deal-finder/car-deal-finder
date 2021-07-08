import { FUEL_TYPE, TRANSMISSION_TYPE } from "../../parser/constants"

export const    AUTORIA_FUEL_TYPE: { [key in FUEL_TYPE]: string } = {
    [FUEL_TYPE.petrol]: 'Бензин',
    [FUEL_TYPE.diesel]: 'Дизель',
    [FUEL_TYPE.electro]: 'Електро',
    [FUEL_TYPE.hybrid]: 'Гібрид',
    [FUEL_TYPE.gas]: 'Газ',
};

export const AUTORIA_TRANSMISSION_TYPE: { [key in TRANSMISSION_TYPE]: string } & { unknown: string; } = {
    [TRANSMISSION_TYPE.manual]: 'Механіка',
    [TRANSMISSION_TYPE.automatic]: 'Автомат',
    unknown: 'Не вказано',
}

export const MIN_RESULT_AMOUNT = 3;