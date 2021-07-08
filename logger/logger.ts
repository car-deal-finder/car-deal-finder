import fs from 'fs';
import csvParser from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import { Log } from './types';
import { Log as LogModel } from '../db';
import { PriceStatistic } from '../platforms/autoria/types';

export default class Logger {
    private logsPath = 'out.csv';
    
    async readLogs(): Promise<Log[]> {
        return LogModel.find();
    }

    async getLogByLink(link: string) {
        return LogModel.findOne({ link });
    }

    async logData(link: string, success: boolean, result?: PriceStatistic['priceType']): Promise<Log> {
        const existedLog = LogModel.findOne({ link });

        const log = {
            link,
            success: success,
            retriesAmount: success ? 0 : (existedLog?.retriesAmount || 0) + 1,
            result,
            processedAt: new Date().toISOString(),
        }

        this.writeLog(log, existedLog);

        return log;
    }

    private async writeLog(log: Log, existedLog) {
        if (existedLog) await existedLog.remove();
        await new LogModel(log).save();
    }
}