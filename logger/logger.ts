import fs from 'fs';
import csvParser from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import { Log } from './types';

export default class Logger {
    private logsPath = 'out.csv';
    
    async readLogs(): Promise<Log[]> {
        return new Promise((resolve) => {
            const results = [];
            fs.createReadStream(this.logsPath)
            .pipe(csvParser())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                resolve(results);
            });
        });
    }

    async getLogByLink(link: string) {
        const logs = await this.readLogs();

        return logs.find(log => log.link === link);
    }

    async logData(link: string, success: boolean): Promise<Log> {
        const logs: Log[] = await this.readLogs();

        const existedLog = logs.find(logItem => logItem.link === link);

        const log = {
            link,
            success,
            retriesAmount: success || !existedLog ? 0 : existedLog.retriesAmount + 1,
            processedAt: new Date().toString(),
        }

        this.writeLog(log, logs, existedLog);

        return log;
    }

    private async writeLog(log: Log, logs: Log[], existedLog: Log) {
        const newLogs: Log[] = logs.filter(logItem => {
            return !existedLog || existedLog.link !== logItem.link;
        });

        newLogs.push(log);

        await new Promise((resolve) => fs.writeFile(this.logsPath, '', () => resolve('cleared')));

        const writer = createObjectCsvWriter({
            path: this.logsPath,
            header: [
                {id: 'link', title: 'link'},
                {id: 'processedAt', title: 'processedAt'},
                {id: 'success', title: 'success'},
                {id: 'retriesAmount', title: 'retriesAmount'},
            ]
          })

        return writer.writeRecords(newLogs);
    }
}